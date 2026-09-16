import { describe, it, expect, vi } from 'vitest';
import { UsersService } from './users.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('UsersService', () => {
  it('lists all users with their org name, ordered by org then name', async () => {
    const rows = [
      { id: 'u1', name: 'Ada', role: 'Manager', orgId: 'org-1', organization: { name: 'Acme' } },
    ];
    const findMany = vi.fn().mockResolvedValue(rows);
    const executeRaw = vi.fn();
    const tx = { user: { findMany }, $executeRaw: executeRaw };
    const prisma = { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(tx)) } as unknown as PrismaService;
    const service = new UsersService(prisma);

    const result = await service.listAll();

    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      include: { organization: true },
      orderBy: [{ orgId: 'asc' }, { name: 'asc' }],
    });
    expect(result).toEqual([{ id: 'u1', name: 'Ada', role: 'Manager', orgId: 'org-1', orgName: 'Acme' }]);
  });
});
