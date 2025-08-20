import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  // Enable CORS for frontend
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;

  await app.listen(port);

  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`🔥 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`📅 Google Calendar integration: ${process.env.GOOGLE_CLIENT_ID ? '✅ Enabled' : '❌ Disabled'}`);
  logger.log(`🔥 Firebase project: ${process.env.FIREBASE_PROJECT_ID || 'Not configured'}`);
}

bootstrap();