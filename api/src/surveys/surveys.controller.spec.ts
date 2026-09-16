import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { SurveysController } from './surveys.controller.js';
import { SurveysService } from './surveys.service.js';
import type { Request } from 'express';

function requestWithTenant(orgId: string, tx: unknown, role: 'Member' | 'Manager' = 'Member', userId = 'u1') {
  return { user: { id: userId, orgId, name: 'Ada', role }, tx } as unknown as Request;
}

describe('SurveysController', () => {
  describe('GET /surveys/active', () => {
    it('returns the active survey for the caller org, keyed by the caller user id', async () => {
      const survey = { id: 's1', title: 'Weekly Pulse', questions: [], hasResponded: false };
      const service = { getActiveSurvey: vi.fn().mockResolvedValue(survey) } as unknown as SurveysService;
      const controller = new SurveysController(service);
      const tx = {};
      const request = requestWithTenant('org-1', tx, 'Member', 'u1');

      const result = await controller.getActive(request);

      expect(result).toBe(survey);
      expect(service.getActiveSurvey).toHaveBeenCalledWith(tx, 'org-1', 'u1');
    });

    it('throws 404 when there is no active survey', async () => {
      const service = { getActiveSurvey: vi.fn().mockResolvedValue(null) } as unknown as SurveysService;
      const controller = new SurveysController(service);
      const request = requestWithTenant('org-1', {});

      await expect(controller.getActive(request)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('POST /surveys/:id/responses', () => {
    // Manager/Member enforcement is RolesGuard's job — see auth/roles.guard.spec.ts.
    it('delegates to the service with tx, orgId, userId, surveyId (route param), and body answers', async () => {
      const created = { id: 'r1', surveyId: 's1', userId: 'u1', answers: [] };
      const service = { submitResponse: vi.fn().mockResolvedValue(created) } as unknown as SurveysService;
      const controller = new SurveysController(service);
      const tx = {};
      const request = requestWithTenant('org-1', tx, 'Member', 'u1');
      const body = { answers: [{ questionId: 'q1', value: 4 }, { questionId: 'q2', value: true }] };

      const result = await controller.submitResponse(request, 's1', body);

      expect(result).toBe(created);
      expect(service.submitResponse).toHaveBeenCalledWith(tx, {
        orgId: 'org-1',
        userId: 'u1',
        surveyId: 's1',
        answers: body.answers,
      });
    });
  });
});
