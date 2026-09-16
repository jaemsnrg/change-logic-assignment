import { Controller, Get, NotFoundException, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard.js';
import { TenantTransactionInterceptor } from '../tenant/tenant-transaction.interceptor.js';
import type { RequestUser } from '../auth/request-user.js';
import { SurveysService } from './surveys.service.js';

@Controller('surveys')
@UseGuards(AuthGuard)
@UseInterceptors(TenantTransactionInterceptor)
export class SurveysController {
  constructor(private readonly surveysService: SurveysService) {}

  @Get('active')
  async getActive(@Req() request: Request) {
    const user = request.user as RequestUser;
    const survey = await this.surveysService.getActiveSurvey(request.tx as Prisma.TransactionClient, user.orgId);

    if (!survey) {
      throw new NotFoundException('No active survey for this organization');
    }

    return survey;
  }
}
