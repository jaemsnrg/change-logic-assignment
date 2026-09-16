import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

process.loadEnvFile();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type QuestionSeed = { type: "rating" | "yesNo"; text: string };
type SurveySeed = { title: string; isActive: boolean; questions: QuestionSeed[] };
type UserSeed = { name: string; role: "Manager" | "Member" };

type OrgSeed = {
  name: string;
  users: UserSeed[];
  surveys: SurveySeed[];
  /** Names of Members (from `users`) who have already submitted a response
   *  to the active survey for the current week. */
  respondedThisWeek: string[];
};

const ORGS: OrgSeed[] = [
  {
    name: "Acme Robotics",
    users: [
      { name: "Priya Shah", role: "Manager" },
      { name: "Diego Ramirez", role: "Member" },
      { name: "Lena Fischer", role: "Member" },
      { name: "Omar Haddad", role: "Member" },
      { name: "Yuki Tanaka", role: "Member" },
    ],
    surveys: [
      {
        title: "Weekly Pulse",
        isActive: true,
        questions: [
          { type: "rating", text: "How would you rate your workload this week?" },
          { type: "yesNo", text: "Did you feel supported by your team this week?" },
          { type: "rating", text: "How satisfied are you with progress on your current project?" },
        ],
      },
      {
        title: "Weekly Pulse (retired draft)",
        isActive: false,
        questions: [{ type: "rating", text: "How would you rate your workload this week?" }],
      },
    ],
    respondedThisWeek: ["Diego Ramirez", "Lena Fischer", "Omar Haddad"],
  },
  {
    name: "Globex Analytics",
    users: [
      { name: "Marcus Cole", role: "Manager" },
      { name: "Ana Beatriz Souza", role: "Member" },
      { name: "Tomasz Wojcik", role: "Member" },
      { name: "Grace Achieng", role: "Member" },
    ],
    surveys: [
      {
        title: "Weekly Check-in",
        isActive: true,
        questions: [
          { type: "yesNo", text: "Did you have the resources you needed this week?" },
          { type: "rating", text: "How manageable was your workload this week?" },
        ],
      },
    ],
    respondedThisWeek: ["Ana Beatriz Souza"],
  },
];

/** Monday (UTC) of the calendar week containing `d`. */
function weekStartUTC(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date;
}

function answerValueFor(type: QuestionSeed["type"]): Prisma.InputJsonValue {
  if (type === "rating") {
    return 1 + Math.floor(Math.random() * 5);
  }
  return Math.random() < 0.7;
}

/** Runs `fn` inside a transaction with the RLS tenant context set for `orgId`. */
async function withTenant<T>(orgId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${orgId}'`);
    return fn(tx);
  });
}

async function clearExisting(orgNames: string[]) {
  const existing = await prisma.organization.findMany({ where: { name: { in: orgNames } } });

  for (const org of existing) {
    await withTenant(org.id, async (tx) => {
      await tx.answer.deleteMany({ where: { response: { orgId: org.id } } });
      await tx.response.deleteMany({ where: { orgId: org.id } });
      await tx.question.deleteMany({ where: { survey: { orgId: org.id } } });
      await tx.survey.deleteMany({ where: { orgId: org.id } });
      await tx.user.deleteMany({ where: { orgId: org.id } });
    });
  }

  await prisma.organization.deleteMany({ where: { name: { in: orgNames } } });
}

async function seedOrg(orgSeed: OrgSeed, weekStart: Date) {
  const org = await prisma.organization.create({ data: { name: orgSeed.name } });

  await withTenant(org.id, async (tx) => {
    const users = new Map<string, { id: string; role: UserSeed["role"] }>();
    for (const u of orgSeed.users) {
      const created = await tx.user.create({ data: { orgId: org.id, name: u.name, role: u.role } });
      users.set(u.name, { id: created.id, role: u.role });
    }

    for (const surveySeed of orgSeed.surveys) {
      const survey = await tx.survey.create({
        data: { orgId: org.id, title: surveySeed.title, isActive: surveySeed.isActive },
      });

      const questions = [];
      for (const [index, q] of surveySeed.questions.entries()) {
        questions.push(
          await tx.question.create({
            data: { surveyId: survey.id, type: q.type, text: q.text, order: index + 1 },
          }),
        );
      }

      if (!surveySeed.isActive) continue;

      for (const memberName of orgSeed.respondedThisWeek) {
        const member = users.get(memberName);
        if (!member || member.role !== "Member") continue;

        const response = await tx.response.create({
          data: { surveyId: survey.id, userId: member.id, orgId: org.id, weekStart },
        });

        for (const question of questions) {
          await tx.answer.create({
            data: {
              responseId: response.id,
              questionId: question.id,
              value: answerValueFor(question.type),
            },
          });
        }
      }
    }
  });

  return org;
}

async function main() {
  const orgNames = ORGS.map((o) => o.name);
  const weekStart = weekStartUTC(new Date());

  console.log(`Clearing existing seed orgs: ${orgNames.join(", ")}`);
  await clearExisting(orgNames);

  for (const orgSeed of ORGS) {
    const org = await seedOrg(orgSeed, weekStart);
    console.log(`Seeded "${org.name}" (${org.id})`);
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
