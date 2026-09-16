import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

@Injectable()
export class SurveysService {
  getActiveSurvey(tx: Prisma.TransactionClient, orgId: string) {
    return tx.survey.findFirst({
      where: { orgId, isActive: true },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
  }
}
