import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { configureApp } from './app.config';
import { AppModule } from './app.module';
import type { Env } from './config/env.schema';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  configureApp(app, config);

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
}

bootstrap().catch((err) => {
  // Logger isn't available if bootstrap fails before useLogger — fall back to console.
  console.error('Fatal bootstrap error', err);
  process.exit(1);
});
