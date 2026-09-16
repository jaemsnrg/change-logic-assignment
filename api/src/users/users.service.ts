import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll() {
    const users = await this.prisma.$transaction(async (tx) => {
      // Deliberately cross-org: no tenant/user session var exists pre-login.
      await tx.$executeRaw`SELECT set_config('app.allow_public_directory', 'true', true)`;
      return tx.user.findMany({
        include: { organization: true },
        orderBy: [{ orgId: 'asc' }, { name: 'asc' }],
      });
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      orgId: u.orgId,
      orgName: u.organization.name,
    }));
  }
}
