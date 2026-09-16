import { Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { TenantTransactionInterceptor } from '../tenant/tenant-transaction.interceptor.js';
import type { RequestUser } from '../auth/request-user.js';
import { SurveysService, type SubmitAnswerInput } from './surveys.service.js';

@Controller('surveys')
@UseGuards(AuthGuard)
@UseInterceptors(TenantTransactionInterceptor)
export class SurveysController {
  constructor(private readonly surveysService: SurveysService) {}

  @Get('active')
  async getActive(@Req() request: Request) {
    const user = request.user as RequestUser;
    const survey = await this.surveysService.getActiveSurvey(
      request.tx as Prisma.TransactionClient,
      user.orgId,
      user.id,
    );

    if (!survey) {
      throw new NotFoundException('No active survey for this organization');
    }

    return survey;
  }

  @Post(':id/responses')
  @UseGuards(RolesGuard)
  @Roles('Member')
  async submitResponse(
    @Req() request: Request,
    @Param('id') surveyId: string,
    @Body() body: { answers: SubmitAnswerInput[] },
  ) {
    const user = request.user as RequestUser;

    return this.surveysService.submitResponse(request.tx as Prisma.TransactionClient, {
      orgId: user.orgId,
      userId: user.id,
      surveyId,
      answers: body.answers,
    });
  }
}
