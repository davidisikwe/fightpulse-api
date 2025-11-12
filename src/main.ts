// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';
// import * as dotenv from 'dotenv';
// import { ValidationPipe } from '@nestjs/common';

// dotenv.config();

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);

//   app.enableCors({
//     origin: true, // Allow all origins (for Lambda and frontend)
//     credentials: true,
//   });
//   app.useGlobalPipes(
//     new ValidationPipe({
//       disableErrorMessages: true,
//     }),
//   );

//   await app.listen(process.env.PORT ?? 3000);
// }
// bootstrap();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import { ValidationPipe } from '@nestjs/common';

dotenv.config();

async function bootstrap() {
  try {
    // --- New log to show bootstrap is starting ---
    console.log('--- [main.ts] Starting NestJS Bootstrap ---');

    const app = await NestFactory.create(AppModule);

    app.enableCors({
      origin: true, // Allow all origins (for Lambda and frontend)
      credentials: true,
    });
    app.useGlobalPipes(
      new ValidationPipe({
        disableErrorMessages: true,
      }),
    );

    await app.listen(process.env.PORT ?? 3000, '0.0.0.0');

    // --- New log to show bootstrap was successful ---
    console.log(
      `--- [main.ts] Application is running on: ${await app.getUrl()} ---`,
    );
  } catch (error) {
    // --- THIS IS THE CRITICAL PART ---
    // This will catch the silent crash
    console.error('--- [main.ts] !!! BOOTSTRAP FAILED !!! ---');
    console.error(error); // Print the full error
    process.exit(1); // Exit with a failure code to force a restart
  }
}

bootstrap();
