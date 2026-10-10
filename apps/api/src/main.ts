import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { setupSwagger } from './swagger.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  setupSwagger(app);
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();