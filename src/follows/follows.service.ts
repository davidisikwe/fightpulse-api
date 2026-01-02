import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FollowsService {
  constructor(private prisma: PrismaService) {}

  async followFighter(userId: string, fighterId: string) {
    try {
      return await this.prisma.follow.create({
        data: {
          userId,
          fighterId,
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        // Unique constraint failed = User already follows this fighter.
        // We can just return the existing relationship or null.
        return null;
      }
      throw error;
    }
  }

  async unfollowFighter(userId: string, fighterId: string) {
    // We use deleteMany because we are deleting by a composite key (userId + fighterId)
    // delete() requires the unique 'id' of the Follow row, which we might not have handy.
    return await this.prisma.follow.deleteMany({
      where: {
        userId: userId,
        fighterId: fighterId,
      },
    });
  }

  async getUserFollowedFighters(userId: string) {
    return await this.prisma.follow.findMany({
      where: { userId },
      include: {
        fighter: true, // This fetches the actual fighter details!
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
