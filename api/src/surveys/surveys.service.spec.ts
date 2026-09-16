import { describe, it, expect, vi } from 'vitest';
import { SurveysService } from './surveys.service.js';
import type { Prisma } from '@prisma/client';

describe('SurveysService', () => {
  it('getActiveSurvey queries the given tx for the org active survey with questions ordered', async () => {
    const survey = { id: 's1', orgId: 'org-1', title: 'Weekly Pulse', isActive: true, questions: [] };
    const findFirst = vi.fn().mockResolvedValue(survey);
    const tx = { survey: { findFirst } } as unknown as Prisma.TransactionClient;
    const service = new SurveysService();

    const result = await service.getActiveSurvey(tx, 'org-1');

    expect(result).toBe(survey);
    expect(findFirst).toHaveBeenCalledWith({
      where: { orgId: 'org-1', isActive: true },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
  });

  it('returns null when there is no active survey for the org', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const tx = { survey: { findFirst } } as unknown as Prisma.TransactionClient;
    const service = new SurveysService();

    expect(await service.getActiveSurvey(tx, 'org-1')).toBeNull();
  });
});
