import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { AuthzModule } from '../authz/authz.module';
import { UserController } from './user.controller';

@Module({
  imports: [AuthzModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
