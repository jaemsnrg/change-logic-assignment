import type { Role } from '@prisma/client';

export interface RequestUser {
  id: string;
  orgId: string;
  name: string;
  role: Role;
}
