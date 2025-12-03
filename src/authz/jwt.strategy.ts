// src/authz/jwt.strategy.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import * as dotenv from 'dotenv';
import { UserService } from '../user/user.service';

dotenv.config();

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private userService: UserService) {
    super({
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${process.env.AUTH0_ISSUER_URL}.well-known/jwks.json`,
      }),

      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience: process.env.AUTH0_AUDIENCE,
      issuer: `${process.env.AUTH0_ISSUER_URL}`,
      algorithms: ['RS256'],
    });
  }

  // async validate(payload: any): Promise<any> {
  //   const user = await this.userService.findOrCreateUser(payload);
  //   return user; // This becomes req.user
  // }
  async validate(payload: any) {
    const namespace = 'https://fightpulse-api.com';

    // 1. Check if email exists (failsafe if Action is disabled)
    const email = payload[`${namespace}/email`];
    if (!email) {
      throw new UnauthorizedException(
        'Access Token missing email claim. Check Auth0 Action.',
      );
    }

    // 2. Map Payload to Clean Object
    const auth0User = {
      sub: payload.sub,
      email: email,
      picture: payload[`${namespace}/picture`],
      email_verified: payload[`${namespace}/email_verified`],
      name: payload[`${namespace}/name`],
      // Convert Unix Timestamp (seconds) to Date object (milliseconds)
      loginTime: new Date(payload.iat * 1000),
    };

    // 3. Find or Update User in DB
    const user = await this.userService.findOrCreateUser(auth0User);

    return user; // This is injected into req.user
  }
}
