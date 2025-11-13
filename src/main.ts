// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import { ValidationPipe } from '@nestjs/common';

dotenv.config();

async function bootstrap() {
  try {
    console.log('--- [main.ts] Starting NestJS Bootstrap ---');

    const app = await NestFactory.create(AppModule);

    app.enableCors({
      origin: true,
      credentials: true,
    });
    app.useGlobalPipes(
      new ValidationPipe({
        disableErrorMessages: true,
      }),
    );

    const port = process.env.PORT ?? 8080;
    await app.listen(port, '0.0.0.0');

    // --- THIS IS THE NEW, VISIBLE CHANGE ---
    console.log(
      `--- [main.ts] V2 DEPLOY: Application listening on 0.0.0.0:${port} ---`,
    );
  } catch (error) {
    console.error('--- [main.ts] !!! BOOTSTRAP FAILED !!! ---');
    console.error(error);
    process.exit(1);
  }
}

bootstrap();
