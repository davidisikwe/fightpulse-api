import {
  Controller,
  Post,
  Get,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Param } from '@nestjs/common';
import { FollowsService } from './follows.service';

@Controller('follows')
export class FollowsController {
  constructor(private followsService: FollowsService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('fighters/:id/follow')
  async follow(@Request() req, @Param('id') fighterId: string) {
    // 1. Get the authenticated User's ID from our synced DB User object
    // (Ensure your JWT strategy injects the DB user, or look it up here via auth0Id)
    const userId = req.user.id;
    return await this.followsService.followFighter(userId, fighterId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('fighters/:id/follow')
  async unfollow(@Request() req, @Param('id') fighterId: string) {
    const userId = req.user.id;
    return await this.followsService.unfollowFighter(userId, fighterId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('user/follows')
  async getMyFollows(@Request() req) {
    const userId = req.user.id;
    return await this.followsService.getUserFollowedFighters(userId);
  }
}
