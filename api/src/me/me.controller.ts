import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard.js';
import type { RequestUser } from '../auth/request-user.js';

@Controller('me')
@UseGuards(AuthGuard)
export class MeController {
  @Get()
  getMe(@Req() request: Request): RequestUser {
    return request.user as RequestUser;
  }
}
