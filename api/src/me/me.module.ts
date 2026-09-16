import { Module } from '@nestjs/common';
import { MeController } from './me.controller.js';
import { AuthGuard } from '../auth/auth.guard.js';

@Module({
  controllers: [MeController],
  providers: [AuthGuard],
})
export class MeModule {}
