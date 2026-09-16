import { Module } from '@nestjs/common';
import { SurveysController } from './surveys.controller.js';
import { SurveysService } from './surveys.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { TenantTransactionInterceptor } from '../tenant/tenant-transaction.interceptor.js';

@Module({
  controllers: [SurveysController],
  providers: [SurveysService, AuthGuard, TenantTransactionInterceptor],
})
export class SurveysModule {}
