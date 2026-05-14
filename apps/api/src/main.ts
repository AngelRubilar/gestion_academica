import 'reflect-metadata';
import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import type { Env } from './config/env.schema';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const swaggerEnabled = config.get('SWAGGER_ENABLED', { infer: true });

  app.use(
    helmet({
      // Swagger UI requires inline scripts/styles that helmet's default CSP blocks.
      // Safe to disable globally: this is a JSON API with no HTML routes outside /api/docs.
      contentSecurityPolicy: swaggerEnabled ? false : undefined,
    }),
  );
  app.use(compression());

  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
  });

  app.setGlobalPrefix('api', { exclude: ['/health'] });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Gestión Académica API')
      .setDescription('API del sistema de gestión académica')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/docs-json',
    });
  }

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
}

bootstrap().catch((err) => {
  // Logger isn't available if bootstrap fails before useLogger — fall back to console.
  console.error('Fatal bootstrap error', err);
  process.exit(1);
});
