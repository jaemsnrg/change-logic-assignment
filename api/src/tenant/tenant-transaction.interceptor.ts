import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { from, Observable, firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RequestUser } from '../auth/request-user.js';

// Wraps the handler in a transaction with app.tenant_id set (adr-0001).
// Handlers must query via request.tx, not PrismaService, to stay scoped.
@Injectable()
export class TenantTransactionInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser;

    return from(
      this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${user.orgId}, true)`;
        request.tx = tx;
        return firstValueFrom(next.handle());
      }),
    );
  }
}
