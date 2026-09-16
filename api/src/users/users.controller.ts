import { Controller, Get } from '@nestjs/common';
import { UsersService } from './users.service.js';

// Deliberately public: the pre-login directory the picker reads from.
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getUsers() {
    return this.usersService.listAll();
  }
}
