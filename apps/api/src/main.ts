import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { join } from 'node:path';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const globalPrefix = 'api';
  const webRoot = join(__dirname, '..', 'library', 'browser');

  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:4200',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.setGlobalPrefix(globalPrefix);
  app.useStaticAssets(webRoot);
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (
      request.method === 'GET' &&
      !request.path.startsWith(`/${globalPrefix}`) &&
      request.accepts('html')
    ) {
      response.sendFile(join(webRoot, 'index.html'));
      return;
    }

    next();
  });
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  Logger.log(
    `Application is running on http://localhost:${port}/${globalPrefix}`,
  );
}

void bootstrap();
