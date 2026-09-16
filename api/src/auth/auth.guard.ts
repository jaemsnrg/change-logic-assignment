import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RequestUser } from './request-user.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.headers['x-user-id'];

    if (!userId || typeof userId !== 'string') {
      throw new UnauthorizedException('Missing X-User-Id header');
    }

    const user = await this.prisma.$transaction(async (tx) => {
      // Bootstrap: RLS only allows this row through pre-tenant-context via id match (see users_self_lookup_policy migration).
      await tx.$executeRaw`SELECT set_config('app.requesting_user_id', ${userId}, true)`;
      return tx.user.findUnique({ where: { id: userId } });
    });

    if (!user) {
      throw new UnauthorizedException('Unknown user');
    }

    request.user = user satisfies RequestUser;
    return true;
  }
}
