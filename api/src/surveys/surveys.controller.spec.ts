import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { SurveysController } from './surveys.controller.js';
import { SurveysService } from './surveys.service.js';
import type { Request } from 'express';

function requestWithTenant(orgId: string, tx: unknown) {
  return { user: { id: 'u1', orgId, name: 'Ada', role: 'Member' }, tx } as unknown as Request;
}

describe('SurveysController', () => {
  it('returns the active survey for the caller org', async () => {
    const survey = { id: 's1', title: 'Weekly Pulse', questions: [] };
    const service = { getActiveSurvey: vi.fn().mockResolvedValue(survey) } as unknown as SurveysService;
    const controller = new SurveysController(service);
    const tx = {};
    const request = requestWithTenant('org-1', tx);

    const result = await controller.getActive(request);

    expect(result).toBe(survey);
    expect(service.getActiveSurvey).toHaveBeenCalledWith(tx, 'org-1');
  });

  it('throws 404 when there is no active survey', async () => {
    const service = { getActiveSurvey: vi.fn().mockResolvedValue(null) } as unknown as SurveysService;
    const controller = new SurveysController(service);
    const request = requestWithTenant('org-1', {});

    await expect(controller.getActive(request)).rejects.toBeInstanceOf(NotFoundException);
  });
});
