import { describe, it, expect, vi } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';

function contextWithUser(role: 'Member' | 'Manager') {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u1', orgId: 'org-1', name: 'Ada', role } }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows the request through when no @Roles() metadata is present', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextWithUser('Manager'))).toBe(true);
  });

  it('allows the request through when the caller has one of the required roles', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['Member']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextWithUser('Member'))).toBe(true);
  });

  it('throws ForbiddenException when the caller lacks any required role', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['Member']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(contextWithUser('Manager'))).toThrow(ForbiddenException);
  });
});
