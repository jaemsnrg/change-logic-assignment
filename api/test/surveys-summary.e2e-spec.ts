import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { addMember, deleteOrg, seedOrgWithActiveSurvey, seedOrgWithActiveSurveyNoMembers } from './fixtures.js';

describe('GET /surveys/:id/summary (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let orgA: Awaited<ReturnType<typeof seedOrgWithActiveSurvey>>;
  let orgB: Awaited<ReturnType<typeof seedOrgWithActiveSurvey>>;
  let orgZero: Awaited<ReturnType<typeof seedOrgWithActiveSurveyNoMembers>>;
  let memberB: Awaited<ReturnType<typeof addMember>>;
  let memberC: Awaited<ReturnType<typeof addMember>>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    orgA = await seedOrgWithActiveSurvey(prisma, 'e2e-summary-A');
    orgB = await seedOrgWithActiveSurvey(prisma, 'e2e-summary-B');
    orgZero = await seedOrgWithActiveSurveyNoMembers(prisma, 'e2e-summary-zero');
    // orgA now has 3 Members total: orgA.member (default), memberB, memberC.
    memberB = await addMember(prisma, orgA.org.id, 'e2e-summary-A Member B');
    memberC = await addMember(prisma, orgA.org.id, 'e2e-summary-A Member C');
  });

  afterAll(async () => {
    await deleteOrg(prisma, orgA.org.id);
    await deleteOrg(prisma, orgB.org.id);
    await deleteOrg(prisma, orgZero.org.id);
    await app.close();
  });

  it('returns 401 without auth', async () => {
    await request(app.getHttpServer()).get(`/surveys/${orgA.activeSurvey.id}/summary`).expect(401);
  });

  it('returns 403 for a Member caller', async () => {
    await request(app.getHttpServer())
      .get(`/surveys/${orgA.activeSurvey.id}/summary`)
      .set('X-User-Id', orgA.member.id)
      .expect(403);
  });

  it("returns 404 when the survey belongs to another org (invisible under the caller's RLS context)", async () => {
    await request(app.getHttpServer())
      .get(`/surveys/${orgB.activeSurvey.id}/summary`)
      .set('X-User-Id', orgA.manager.id)
      .expect(404);
  });

  it('returns 404 for an unknown survey id', async () => {
    await request(app.getHttpServer())
      .get('/surveys/does-not-exist/summary')
      .set('X-User-Id', orgA.manager.id)
      .expect(404);
  });

  it('returns 409 when the survey is not currently active', async () => {
    await request(app.getHttpServer())
      .get(`/surveys/${orgA.inactiveSurvey.id}/summary`)
      .set('X-User-Id', orgA.manager.id)
      .expect(409);
  });

  it('returns 200 with zero completion and null rating average before any Member has submitted this week', async () => {
    const res = await request(app.getHttpServer())
      .get(`/surveys/${orgA.activeSurvey.id}/summary`)
      .set('X-User-Id', orgA.manager.id)
      .expect(200);

    expect(res.body.completion).toEqual({ count: 0, total: 3, rate: 0 });
    const rating = res.body.questions.find((q: { questionId: string }) => q.questionId === orgA.ratingQuestion.id);
    expect(rating.rating).toEqual({ average: null, count: 0 });
    const yesNo = res.body.questions.find((q: { questionId: string }) => q.questionId === orgA.yesNoQuestion.id);
    expect(yesNo.yesNo).toEqual({ true: 0, false: 0 });
  });

  it('returns completion.rate: null when the org has zero Members', async () => {
    const res = await request(app.getHttpServer())
      .get(`/surveys/${orgZero.activeSurvey.id}/summary`)
      .set('X-User-Id', orgZero.manager.id)
      .expect(200);

    expect(res.body.completion).toEqual({ count: 0, total: 0, rate: null });
  });

  it('reflects completion count/total/rate and per-question rollups after some Members submit', async () => {
    await request(app.getHttpServer())
      .post(`/surveys/${orgA.activeSurvey.id}/responses`)
      .set('X-User-Id', orgA.member.id)
      .send({
        answers: [
          { questionId: orgA.ratingQuestion.id, value: 4 },
          { questionId: orgA.yesNoQuestion.id, value: true },
        ],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/surveys/${orgA.activeSurvey.id}/responses`)
      .set('X-User-Id', memberB.id)
      .send({
        answers: [
          { questionId: orgA.ratingQuestion.id, value: 5 },
          { questionId: orgA.yesNoQuestion.id, value: true },
        ],
      })
      .expect(201);

    // memberC deliberately does not submit.

    const res = await request(app.getHttpServer())
      .get(`/surveys/${orgA.activeSurvey.id}/summary`)
      .set('X-User-Id', orgA.manager.id)
      .expect(200);

    expect(res.body.completion).toEqual({ count: 2, total: 3, rate: 0.67 });

    const rating = res.body.questions.find((q: { questionId: string }) => q.questionId === orgA.ratingQuestion.id);
    expect(rating).toMatchObject({ type: 'rating', text: orgA.ratingQuestion.text, order: orgA.ratingQuestion.order });
    expect(rating.rating).toEqual({ average: 4.5, count: 2 });

    const yesNo = res.body.questions.find((q: { questionId: string }) => q.questionId === orgA.yesNoQuestion.id);
    expect(yesNo).toMatchObject({ type: 'yesNo', text: orgA.yesNoQuestion.text, order: orgA.yesNoQuestion.order });
    expect(yesNo.yesNo).toEqual({ true: 2, false: 0 });
  });

  it("never lets org A's responses leak into org B's summary (isolation)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/surveys/${orgB.activeSurvey.id}/summary`)
      .set('X-User-Id', orgB.manager.id)
      .expect(200);

    expect(res.body.completion).toEqual({ count: 0, total: 1, rate: 0 });
  });
});
