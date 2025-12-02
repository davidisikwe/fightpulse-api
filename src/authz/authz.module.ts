import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { UserModule } from '../user/user.module';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), UserModule],
  providers: [JwtStrategy], // ← Add Auth0Service as provider
  exports: [PassportModule],
})
export class AuthzModule {}
