import type { Prisma } from '@prisma/client';
import type { RequestUser } from '../auth/request-user.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: RequestUser;
    tx?: Prisma.TransactionClient;
  }
}
