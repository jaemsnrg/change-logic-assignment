import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, throwError, firstValueFrom } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { TenantTransactionInterceptor } from './tenant-transaction.interceptor.js';
import { PrismaService } from '../prisma/prisma.service.js';

function contextWithUser(user: Record<string, unknown>) {
  const request: Record<string, unknown> = { user };
  return {
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext,
    request,
  };
}

describe('TenantTransactionInterceptor', () => {
  let prisma: { $transaction: ReturnType<typeof vi.fn> };
  let tx: { $executeRaw: ReturnType<typeof vi.fn> };
  let interceptor: TenantTransactionInterceptor;

  beforeEach(() => {
    tx = { $executeRaw: vi.fn() };
    prisma = { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(tx)) };
    interceptor = new TenantTransactionInterceptor(prisma as unknown as PrismaService);
  });

  it('sets app.tenant_id from the resolved user before invoking the handler', async () => {
    const { context, request } = contextWithUser({ id: 'u1', orgId: 'org-1' });
    const handler: CallHandler = { handle: () => of('handler-result') };

    const result = await firstValueFrom(interceptor.intercept(context, handler));

    expect(result).toBe('handler-result');
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(request.tx).toBe(tx);
  });

  it('propagates handler errors and does not swallow them', async () => {
    const { context } = contextWithUser({ id: 'u1', orgId: 'org-1' });
    const handler: CallHandler = { handle: () => throwError(() => new Error('boom')) };

    await expect(firstValueFrom(interceptor.intercept(context, handler))).rejects.toThrow('boom');
  });
});
