import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { deleteOrg, seedOrgWithNoActiveSurvey } from './fixtures.js';

describe('GET /users (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let org: Awaited<ReturnType<typeof seedOrgWithNoActiveSurvey>>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    org = await seedOrgWithNoActiveSurvey(prisma, 'e2e-users');
  });

  afterAll(async () => {
    await deleteOrg(prisma, org.org.id);
    await app.close();
  });

  it('lists users across orgs without requiring auth', async () => {
    const res = await request(app.getHttpServer()).get('/users').expect(200);

    expect(res.body).toContainEqual(
      expect.objectContaining({ id: org.member.id, name: org.member.name, orgName: org.org.name }),
    );
  });
});
