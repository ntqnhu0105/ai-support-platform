import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';

export function configureApp(app: INestApplication): void {
  // WEB_URL can hold several origins separated by commas.
  const webOrigins = (process.env.WEB_URL ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({ origin: webOrigins, credentials: true });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}