// import { Module } from '@nestjs/common';
// import { AppController } from './app.controller';
// import { AppService } from './app.service';
// import { AuthzModule } from './authz/authz.module';
// import { UserModule } from './user/user.module';
// import { PrismaModule } from './prisma/prisma.module';
// import { IngestionModule } from './scrapper/ingestion.module';
// import { ConfigModule } from '@nestjs/config';

// @Module({

//   imports: [ConfigModule.forRoot({ isGlobal: true }),AuthzModule, UserModule, PrismaModule, IngestionModule],
//   controllers: [AppController],
//   providers: [AppService],
// })
// export class AppModule {}

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { IngestionModule } from './scrapper/ingestion.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    IngestionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
