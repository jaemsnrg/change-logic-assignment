import { describe, it, expect, vi } from 'vitest';
import { UsersController } from './users.controller.js';
import type { UsersService } from './users.service.js';

describe('UsersController', () => {
  it('returns the full user directory', async () => {
    const users = [{ id: 'u1', name: 'Ada', role: 'Manager', orgId: 'org-1', orgName: 'Acme' }];
    const service = { listAll: vi.fn().mockResolvedValue(users) } as unknown as UsersService;
    const controller = new UsersController(service);

    expect(await controller.getUsers()).toBe(users);
  });
});
