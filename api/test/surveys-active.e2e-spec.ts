import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { deleteOrg, seedOrgWithActiveSurvey, seedOrgWithNoActiveSurvey, withTenant } from './fixtures.js';

describe('GET /me and GET /surveys/active (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let orgA: Awaited<ReturnType<typeof seedOrgWithActiveSurvey>>;
  let orgB: Awaited<ReturnType<typeof seedOrgWithNoActiveSurvey>>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    orgA = await seedOrgWithActiveSurvey(prisma, 'e2e-A');
    orgB = await seedOrgWithNoActiveSurvey(prisma, 'e2e-B');
  });

  afterAll(async () => {
    await deleteOrg(prisma, orgA.org.id);
    await deleteOrg(prisma, orgB.org.id);
    await app.close();
  });

  describe('GET /me', () => {
    it('returns 401 without an X-User-Id header', async () => {
      await request(app.getHttpServer()).get('/me').expect(401);
    });

    it('returns 401 for an unknown user id', async () => {
      await request(app.getHttpServer()).get('/me').set('X-User-Id', 'does-not-exist').expect(401);
    });

    it('resolves the caller from the header', async () => {
      const res = await request(app.getHttpServer())
        .get('/me')
        .set('X-User-Id', orgA.member.id)
        .expect(200);

      expect(res.body).toMatchObject({
        id: orgA.member.id,
        orgId: orgA.org.id,
        name: orgA.member.name,
        role: 'Member',
      });
    });
  });

  describe('GET /surveys/active', () => {
    it('returns 401 without auth', async () => {
      await request(app.getHttpServer()).get('/surveys/active').expect(401);
    });

    it("returns the org's active survey with questions ordered by `order`", async () => {
      const res = await request(app.getHttpServer())
        .get('/surveys/active')
        .set('X-User-Id', orgA.member.id)
        .expect(200);

      expect(res.body.id).toBe(orgA.activeSurvey.id);
      expect(res.body.isActive).toBe(true);
      expect(res.body.questions.map((q: { text: string }) => q.text)).toEqual([
        'First question',
        'Second question',
      ]);
    });

    it('works for a Manager caller too (role is not restricted on this route)', async () => {
      await request(app.getHttpServer())
        .get('/surveys/active')
        .set('X-User-Id', orgA.manager.id)
        .expect(200);
    });

    it('returns 404 when the caller org has no active survey', async () => {
      await request(app.getHttpServer())
        .get('/surveys/active')
        .set('X-User-Id', orgB.member.id)
        .expect(404);
    });

    it("never returns another org's active survey, even from a raw query missing an orgId filter (RLS-backed via the pulse_app runtime role, not just the app-layer filter above)", async () => {
      const surveys = await withTenant(prisma, orgB.org.id, (tx) => tx.survey.findMany());
      expect(surveys.find((s) => s.id === orgA.activeSurvey.id)).toBeUndefined();
    });
  });
});
