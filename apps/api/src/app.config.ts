import { INestApplication, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import type { Env } from './config/env.schema';

/**
 * Aplica la configuración compartida de la aplicación: seguridad (helmet),
 * compresión, CORS, prefijo global, versionado y Swagger.
 *
 * La usan tanto `main.ts` como la suite E2E para garantizar que los tests
 * se ejecuten contra exactamente la misma configuración que producción.
 *
 * NO incluye: creación de la app, `useLogger`, `enableShutdownHooks` ni
 * `listen` — esos son responsabilidad del proceso que arranca la app.
 */
export function configureApp(
  app: INestApplication,
  config: ConfigService<Env, true>,
): void {
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
}
