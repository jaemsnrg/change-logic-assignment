import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';

function contextWithHeaders(headers: Record<string, string>, request: Record<string, unknown> = {}) {
  Object.assign(request, { headers });
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  let prisma: { $transaction: ReturnType<typeof vi.fn> };
  let tx: { $executeRaw: ReturnType<typeof vi.fn>; user: { findUnique: ReturnType<typeof vi.fn> } };
  let guard: AuthGuard;

  beforeEach(() => {
    tx = { $executeRaw: vi.fn(), user: { findUnique: vi.fn() } };
    prisma = { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(tx)) };
    guard = new AuthGuard(prisma as unknown as PrismaService);
  });

  it('throws 401 when X-User-Id header is missing', async () => {
    const context = contextWithHeaders({});
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws 401 when the user does not exist', async () => {
    tx.user.findUnique.mockResolvedValue(null);
    const context = contextWithHeaders({ 'x-user-id': 'unknown-id' });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('sets the bootstrap session var before looking up the user, then attaches the user to the request', async () => {
    const user = { id: 'user-1', orgId: 'org-1', name: 'Ada', role: 'Manager' };
    tx.user.findUnique.mockResolvedValue(user);
    const request: Record<string, unknown> = {};
    const context = contextWithHeaders({ 'x-user-id': 'user-1' }, request);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    expect(request.user).toEqual(user);
  });
});
