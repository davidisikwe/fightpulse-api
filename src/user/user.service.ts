import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface Auth0User {
  sub: string; // Auth0 user ID
  email: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
  loginTime?: Date;
}

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  /**
   * Find or create a user from Auth0 payload
   * This method is called on every authenticated request
   */
  // async findOrCreateUser(auth0User: Auth0User) {
  //   console.log('Auth0User received:', auth0User); // ← Add this line
  //   console.log('Email value:', auth0User.email);
  //   const auth0Id = auth0User.sub;

  //   // Try to find existing user by Auth0 ID
  //   let user = await this.prisma.user.findUnique({
  //     where: { auth0Id },
  //   });

  //   if (!user) {
  //     // Create new user if doesn't exist
  //     user = await this.prisma.user.create({
  //       data: {
  //         auth0Id,
  //         email: auth0User.email,
  //         username: this.generateUsername(auth0User.email, auth0User.name),
  //         profilePic: auth0User.picture,
  //         emailVerified: auth0User.email_verified || false,
  //         lastLoginAt: auth0User.loginTime,
  //       },
  //     });
  //   } else {
  //     // Update existing user with latest Auth0 data
  //     user = await this.prisma.user.update({
  //       where: { id: user.id },
  //       data: {
  //         email: auth0User.email,
  //         username:
  //           user.username ||
  //           this.generateUsername(auth0User.email, auth0User.name),
  //         profilePic: auth0User.picture || user.profilePic,
  //         emailVerified: auth0User.email_verified || user.emailVerified,
  //         lastLoginAt: auth0User.loginTime,
  //       },
  //     });
  //   }

  //   return user;
  // }
  async findOrCreateUser(auth0User: Auth0User) {
    const auth0Id = auth0User.sub;

    let user = await this.prisma.user.findUnique({
      where: { auth0Id },
    });

    if (!user) {
      // 1. CREATE (No changes needed here)
      user = await this.prisma.user.create({
        data: {
          auth0Id,
          email: auth0User.email,
          username: this.generateUsername(auth0User.email, auth0User.name),
          profilePic: auth0User.picture,
          emailVerified: auth0User.email_verified || false,
          lastLoginAt: auth0User.loginTime,
        },
      });
    } else {
      // 2. UPDATE (Optimized)
      // IMPORTANT: If JWT says email_verified=true, always trust it (user got new token after verification)
      // If JWT says false but DB says true, keep DB=true (don't downgrade)
      const jwtEmailVerified = auth0User.email_verified || false;
      const finalEmailVerified = jwtEmailVerified || user.emailVerified;

      // Check if ANY field is different. This saves DB writes on 99% of requests.
      const isProfileOutdated =
        user.email !== auth0User.email ||
        user.profilePic !== auth0User.picture ||
        user.emailVerified !== finalEmailVerified;

      // We always want to update lastLoginAt, but we can combine it with the profile check
      if (isProfileOutdated) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            email: auth0User.email,
            profilePic: auth0User.picture,
            emailVerified: finalEmailVerified, // Use the merged value
            lastLoginAt: auth0User.loginTime,
          },
        });
      } else {
        // Optional: If profile didn't change, maybe just update login time?
        // Or skip entirely to make it super fast.
        // For accurate "last seen", you usually want this:
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: auth0User.loginTime },
        });
      }
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
