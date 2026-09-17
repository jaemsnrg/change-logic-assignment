import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { MeModule } from './me/me.module.js';
import { SurveysModule } from './surveys/surveys.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [PrismaModule, MeModule, SurveysModule, UsersModule],
})
export class AppModule {}
