import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface Auth0User {
  sub: string; // Auth0 user ID
  email: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
}

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  /**
   * Find or create a user from Auth0 payload
   * This method is called on every authenticated request
   */
  async findOrCreateUser(auth0User: Auth0User) {
    console.log('Auth0User received:', auth0User); // ← Add this line
    console.log('Email value:', auth0User.email);
    const auth0Id = auth0User.sub;

    // Try to find existing user by Auth0 ID
    let user = await this.prisma.user.findUnique({
      where: { auth0Id },
    });

    if (!user) {
      // Create new user if doesn't exist
      user = await this.prisma.user.create({
        data: {
          auth0Id,
          email: auth0User.email,
          username: this.generateUsername(auth0User.email, auth0User.name),
          profilePic: auth0User.picture,
          emailVerified: auth0User.email_verified || false,
        },
      });
    } else {
      // Update existing user with latest Auth0 data
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          email: auth0User.email,
          username:
            user.username ||
            this.generateUsername(auth0User.email, auth0User.name),
          profilePic: auth0User.picture || user.profilePic,
          emailVerified: auth0User.email_verified || user.emailVerified,
          lastLoginAt: new Date(),
        },
      });
    }

    return user;
  }

  /**
   * Get user by Auth0 ID
   */
  async findByAuth0Id(auth0Id: string) {
    return this.prisma.user.findUnique({
      where: { auth0Id },
    });
  }

  /**
   * Get user by database ID
   */
  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Generate a username from email or name
   */
  private generateUsername(email: string, name?: string): string {
    if (name) {
      return name.toLowerCase().replace(/\s+/g, '_');
    }
    return email.split('@')[0];
  }
}
