import { PrismaService } from '../src/prisma/prisma.service.js';

/** Runs `fn` inside a transaction with the RLS tenant context set for `orgId`. */
export async function withTenant<T>(
  prisma: PrismaService,
  orgId: string,
  fn: (tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0]) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${orgId}, true)`;
    return fn(tx);
  });
}

export async function seedOrgWithActiveSurvey(prisma: PrismaService, namePrefix: string) {
  const org = await prisma.organization.create({ data: { name: `${namePrefix} Org` } });

  return withTenant(prisma, org.id, async (tx) => {
    const manager = await tx.user.create({
      data: { orgId: org.id, name: `${namePrefix} Manager`, role: 'Manager' },
    });
    const member = await tx.user.create({
      data: { orgId: org.id, name: `${namePrefix} Member`, role: 'Member' },
    });
    const activeSurvey = await tx.survey.create({
      data: { orgId: org.id, title: `${namePrefix} Active Survey`, isActive: true },
    });
    const yesNoQuestion = await tx.question.create({
      data: { surveyId: activeSurvey.id, type: 'yesNo', text: 'Second question', order: 2 },
    });
    const ratingQuestion = await tx.question.create({
      data: { surveyId: activeSurvey.id, type: 'rating', text: 'First question', order: 1 },
    });
    const inactiveSurvey = await tx.survey.create({
      data: { orgId: org.id, title: `${namePrefix} Inactive Survey`, isActive: false },
    });

    return { org, manager, member, activeSurvey, inactiveSurvey, ratingQuestion, yesNoQuestion };
  });
}

export async function seedOrgWithNoActiveSurvey(prisma: PrismaService, namePrefix: string) {
  const org = await prisma.organization.create({ data: { name: `${namePrefix} Org` } });

  return withTenant(prisma, org.id, async (tx) => {
    const member = await tx.user.create({
      data: { orgId: org.id, name: `${namePrefix} Member`, role: 'Member' },
    });

    return { org, member };
  });
}

export async function deleteOrg(prisma: PrismaService, orgId: string) {
  await withTenant(prisma, orgId, async (tx) => {
    await tx.answer.deleteMany({ where: { response: { orgId } } });
    await tx.response.deleteMany({ where: { orgId } });
    await tx.question.deleteMany({ where: { survey: { orgId } } });
    await tx.survey.deleteMany({ where: { orgId } });
    await tx.user.deleteMany({ where: { orgId } });
  });
  await prisma.organization.delete({ where: { id: orgId } });
}
