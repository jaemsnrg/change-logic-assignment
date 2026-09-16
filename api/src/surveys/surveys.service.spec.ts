import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SurveysService } from './surveys.service.js';
import type { Prisma as PrismaNS } from '@prisma/client';

const RATING_QUESTION = { id: 'q1', surveyId: 's1', type: 'rating', text: 'First question', order: 1 };
const YES_NO_QUESTION = { id: 'q2', surveyId: 's1', type: 'yesNo', text: 'Second question', order: 2 };

function txWith(overrides: Partial<Record<'survey' | 'response', unknown>>) {
  return {
    survey: { findFirst: vi.fn() },
    response: { findFirst: vi.fn(), create: vi.fn() },
    ...overrides,
  } as unknown as PrismaNS.TransactionClient;
}

describe('SurveysService', () => {
  describe('getActiveSurvey', () => {
    it('queries the given tx for the org active survey with questions ordered', async () => {
      const survey = { id: 's1', orgId: 'org-1', title: 'Weekly Pulse', isActive: true, questions: [] };
      const findFirstSurvey = vi.fn().mockResolvedValue(survey);
      const findFirstResponse = vi.fn().mockResolvedValue(null);
      const tx = txWith({
        survey: { findFirst: findFirstSurvey },
        response: { findFirst: findFirstResponse },
      });
      const service = new SurveysService();

      const result = await service.getActiveSurvey(tx, 'org-1', 'user-1');

      expect(result).toMatchObject(survey);
      expect(findFirstSurvey).toHaveBeenCalledWith({
        where: { orgId: 'org-1', isActive: true },
        include: { questions: { orderBy: { order: 'asc' } } },
      });
    });

    it('returns null when there is no active survey for the org, without checking for a response', async () => {
      const findFirstSurvey = vi.fn().mockResolvedValue(null);
      const findFirstResponse = vi.fn();
      const tx = txWith({
        survey: { findFirst: findFirstSurvey },
        response: { findFirst: findFirstResponse },
      });
      const service = new SurveysService();

      expect(await service.getActiveSurvey(tx, 'org-1', 'user-1')).toBeNull();
      expect(findFirstResponse).not.toHaveBeenCalled();
    });

    it('sets hasResponded: true when the caller already has a Response for the current week', async () => {
      const survey = { id: 's1', orgId: 'org-1', title: 'Weekly Pulse', isActive: true, questions: [] };
      const findFirstResponse = vi.fn().mockResolvedValue({ id: 'r1' });
      const tx = txWith({
        survey: { findFirst: vi.fn().mockResolvedValue(survey) },
        response: { findFirst: findFirstResponse },
      });
      const service = new SurveysService();

      const result = await service.getActiveSurvey(tx, 'org-1', 'user-1');

      expect(result?.hasResponded).toBe(true);
      expect(findFirstResponse).toHaveBeenCalledWith({
        where: { surveyId: 's1', userId: 'user-1', weekStart: expect.any(Date) },
      });
    });

    it('sets hasResponded: false when the caller has no Response for the current week', async () => {
      const survey = { id: 's1', orgId: 'org-1', title: 'Weekly Pulse', isActive: true, questions: [] };
      const tx = txWith({
        survey: { findFirst: vi.fn().mockResolvedValue(survey) },
        response: { findFirst: vi.fn().mockResolvedValue(null) },
      });
      const service = new SurveysService();

      const result = await service.getActiveSurvey(tx, 'org-1', 'user-1');

      expect(result?.hasResponded).toBe(false);
    });
  });

  describe('submitResponse', () => {
    const baseArgs = {
      orgId: 'org-1',
      userId: 'user-1',
      surveyId: 's1',
      answers: [
        { questionId: 'q1', value: 4 },
        { questionId: 'q2', value: true },
      ],
    };

    function surveyTx(surveyOverrides: Partial<typeof activeSurvey> = {}) {
      const survey = { ...activeSurvey, ...surveyOverrides };
      return txWith({ survey: { findFirst: vi.fn().mockResolvedValue(survey) } });
    }

    const activeSurvey = {
      id: 's1',
      orgId: 'org-1',
      title: 'Weekly Pulse',
      isActive: true,
      questions: [RATING_QUESTION, YES_NO_QUESTION],
    };

    it('throws NotFoundException when the survey does not resolve for the org (wrong org / unknown id)', async () => {
      const tx = txWith({ survey: { findFirst: vi.fn().mockResolvedValue(null) } });
      const service = new SurveysService();

      await expect(service.submitResponse(tx, baseArgs)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ConflictException when the survey is not currently active', async () => {
      const tx = surveyTx({ isActive: false });
      const service = new SurveysService();

      await expect(service.submitResponse(tx, baseArgs)).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws BadRequestException when an answer is missing for a question', async () => {
      const tx = surveyTx();
      const service = new SurveysService();

      await expect(
        service.submitResponse(tx, { ...baseArgs, answers: [{ questionId: 'q1', value: 4 }] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when an answer references an unknown questionId', async () => {
      const tx = surveyTx();
      const service = new SurveysService();

      await expect(
        service.submitResponse(tx, {
          ...baseArgs,
          answers: [...baseArgs.answers, { questionId: 'not-a-question', value: 1 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when a rating value is out of range', async () => {
      const tx = surveyTx();
      const service = new SurveysService();

      await expect(
        service.submitResponse(tx, {
          ...baseArgs,
          answers: [{ questionId: 'q1', value: 6 }, { questionId: 'q2', value: true }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when a rating value is not an integer', async () => {
      const tx = surveyTx();
      const service = new SurveysService();

      await expect(
        service.submitResponse(tx, {
          ...baseArgs,
          answers: [{ questionId: 'q1', value: 3.5 }, { questionId: 'q2', value: true }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when a yesNo value is not a boolean', async () => {
      const tx = surveyTx();
      const service = new SurveysService();

      await expect(
        service.submitResponse(tx, {
          ...baseArgs,
          answers: [{ questionId: 'q1', value: 4 }, { questionId: 'q2', value: 'yes' }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates the Response with nested Answers, server-derived weekStart/orgId/userId', async () => {
      const create = vi.fn().mockResolvedValue({
        id: 'r1',
        surveyId: 's1',
        userId: 'user-1',
        orgId: 'org-1',
        weekStart: new Date('2026-09-14T00:00:00Z'),
        answers: [
          { id: 'a1', questionId: 'q1', value: 4 },
          { id: 'a2', questionId: 'q2', value: true },
        ],
      });
      const tx = surveyTx();
      (tx as unknown as { response: { create: typeof create } }).response = { create };
      const service = new SurveysService();

      const result = await service.submitResponse(tx, baseArgs);

      expect(create).toHaveBeenCalledWith({
        data: {
          surveyId: 's1',
          userId: 'user-1',
          orgId: 'org-1',
          weekStart: expect.any(Date),
          answers: {
            create: [
              { questionId: 'q1', value: 4 },
              { questionId: 'q2', value: true },
            ],
          },
        },
        include: { answers: true },
      });
      expect(result.id).toBe('r1');
    });

    it('throws ConflictException when the DB rejects a duplicate (surveyId, userId, weekStart)', async () => {
      const uniqueViolation = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      });
      const create = vi.fn().mockRejectedValue(uniqueViolation);
      const tx = surveyTx();
      (tx as unknown as { response: { create: typeof create } }).response = { create };
      const service = new SurveysService();

      await expect(service.submitResponse(tx, baseArgs)).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
