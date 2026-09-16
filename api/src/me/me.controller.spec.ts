import { describe, it, expect } from 'vitest';
import { MeController } from './me.controller.js';
import type { RequestUser } from '../auth/request-user.js';

describe('MeController', () => {
  it('returns the user attached to the request by AuthGuard', () => {
    const user: RequestUser = { id: 'u1', orgId: 'org-1', name: 'Ada', role: 'Manager' };
    const controller = new MeController();

    expect(controller.getMe({ user } as never)).toEqual(user);
  });
});
