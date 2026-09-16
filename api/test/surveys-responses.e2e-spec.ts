import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { deleteOrg, seedOrgWithActiveSurvey, withTenant } from './fixtures.js';

describe('POST /surveys/:id/responses (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let orgA: Awaited<ReturnType<typeof seedOrgWithActiveSurvey>>;
  let orgB: Awaited<ReturnType<typeof seedOrgWithActiveSurvey>>;

  const validAnswers = () => [
    { questionId: orgA.ratingQuestion.id, value: 4 },
    { questionId: orgA.yesNoQuestion.id, value: true },
  ];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    orgA = await seedOrgWithActiveSurvey(prisma, 'e2e-resp-A');
    orgB = await seedOrgWithActiveSurvey(prisma, 'e2e-resp-B');
  });

  afterAll(async () => {
    await deleteOrg(prisma, orgA.org.id);
    await deleteOrg(prisma, orgB.org.id);
    await app.close();
  });

  it('returns 401 without auth', async () => {
    await request(app.getHttpServer())
      .post(`/surveys/${orgA.activeSurvey.id}/responses`)
      .send({ answers: validAnswers() })
      .expect(401);
  });

  it('returns 403 for a Manager caller', async () => {
    await request(app.getHttpServer())
      .post(`/surveys/${orgA.activeSurvey.id}/responses`)
      .set('X-User-Id', orgA.manager.id)
      .send({ answers: validAnswers() })
      .expect(403);
  });

  it("returns 404 when the survey belongs to another org (invisible under the caller's RLS context)", async () => {
    await request(app.getHttpServer())
      .post(`/surveys/${orgB.activeSurvey.id}/responses`)
      .set('X-User-Id', orgA.member.id)
      .send({ answers: validAnswers() })
      .expect(404);
  });

  it('returns 404 for an unknown survey id', async () => {
    await request(app.getHttpServer())
      .post('/surveys/does-not-exist/responses')
      .set('X-User-Id', orgA.member.id)
      .send({ answers: validAnswers() })
      .expect(404);
  });

  it('returns 409 when the survey is not currently active', async () => {
    await request(app.getHttpServer())
      .post(`/surveys/${orgA.inactiveSurvey.id}/responses`)
      .set('X-User-Id', orgA.member.id)
      .send({ answers: [] })
      .expect(409);
  });

  it('returns 400 when an answer is missing for a question', async () => {
    await request(app.getHttpServer())
      .post(`/surveys/${orgA.activeSurvey.id}/responses`)
      .set('X-User-Id', orgA.member.id)
      .send({ answers: [{ questionId: orgA.ratingQuestion.id, value: 4 }] })
      .expect(400);
  });

  it('returns 400 when a rating value is out of range', async () => {
    await request(app.getHttpServer())
      .post(`/surveys/${orgA.activeSurvey.id}/responses`)
      .set('X-User-Id', orgA.member.id)
      .send({
        answers: [
          { questionId: orgA.ratingQuestion.id, value: 7 },
          { questionId: orgA.yesNoQuestion.id, value: true },
        ],
      })
      .expect(400);
  });

  it('returns 400 when a yesNo value is not a boolean', async () => {
    await request(app.getHttpServer())
      .post(`/surveys/${orgA.activeSurvey.id}/responses`)
      .set('X-User-Id', orgA.member.id)
      .send({
        answers: [
          { questionId: orgA.ratingQuestion.id, value: 4 },
          { questionId: orgA.yesNoQuestion.id, value: 'yes' },
        ],
      })
      .expect(400);
  });

  it("reflects hasResponded: false on GET /surveys/active before the Member has submitted", async () => {
    const res = await request(app.getHttpServer())
      .get('/surveys/active')
      .set('X-User-Id', orgA.member.id)
      .expect(200);

    expect(res.body.hasResponded).toBe(false);
  });

  it('accepts a valid submission from a Member (201), persists Response + Answers, and flips hasResponded', async () => {
    const res = await request(app.getHttpServer())
      .post(`/surveys/${orgA.activeSurvey.id}/responses`)
      .set('X-User-Id', orgA.member.id)
      .send({ answers: validAnswers() })
      .expect(201);

    expect(res.body.surveyId).toBe(orgA.activeSurvey.id);
    expect(res.body.userId).toBe(orgA.member.id);
    expect(res.body.answers).toHaveLength(2);

    const persisted = await withTenant(prisma, orgA.org.id, (tx) =>
      tx.response.findFirst({
        where: { surveyId: orgA.activeSurvey.id, userId: orgA.member.id },
        include: { answers: true },
      }),
    );
    expect(persisted?.answers).toHaveLength(2);

    const activeRes = await request(app.getHttpServer())
      .get('/surveys/active')
      .set('X-User-Id', orgA.member.id)
      .expect(200);
    expect(activeRes.body.hasResponded).toBe(true);
  });

  it('returns 409 on a second submission the same week (write-once)', async () => {
    await request(app.getHttpServer())
      .post(`/surveys/${orgA.activeSurvey.id}/responses`)
      .set('X-User-Id', orgA.member.id)
      .send({ answers: validAnswers() })
      .expect(409);
  });

  it("never lets an org A member's response affect org B's data (isolation)", async () => {
    const orgBResponses = await withTenant(prisma, orgB.org.id, (tx) =>
      tx.response.findMany({ where: { surveyId: orgB.activeSurvey.id } }),
    );
    expect(orgBResponses).toHaveLength(0);
  });
});
