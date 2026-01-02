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

  @Get('status')
  @UseGuards(AuthGuard('jwt'))
  async getVerificationStatus(@Request() req) {
    // The JWT strategy already syncs email_verified from the token to the DB on every request
    // req.user is the DB user object returned from JWT strategy's validate() method
    // So we can just return the status directly from req.user
    // (The service now handles the case where JWT says verified=true but DB says false)
    return { verified: req.user?.emailVerified || false };
  }
}
