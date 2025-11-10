import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserService } from './user.service';
import type { Auth0User } from './user.service';

@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('profile')
  async getProfile(@Request() req, @Body() userData: Auth0User) {
    // Use userData from POST body, not req.user from JWT
    return await this.userService.findOrCreateUser(userData);
  }
}
