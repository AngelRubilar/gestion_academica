# Spec — Config base NestJS

- **Fecha:** 2026-04-30
- **Issue:** [#4 [B0-04] Config base NestJS](https://github.com/AngelRubilar/gestion_academica/issues/4)
- **Rama de trabajo:** `feature/4-config-base-nestjs` (apilada sobre `feature/3-schema-prisma` / PR #82)
- **Estado:** Aprobado en brainstorming, pendiente plan de implementación

## Contexto y motivación

`apps/api/` está vacía (solo `Dockerfile`, `package.json` placeholder, `.env`, `tsconfig.json`). Antes de escribir cualquier CRUD, el equipo necesita los **cimientos comunes** del backend: configuración tipada, conexión a Prisma, manejo uniforme de errores y respuestas, autorización basada en roles, logging estructurado y documentación interactiva (Swagger).

Esta PR construye esa capa común para que cualquier CRUD posterior (#12–#20, #69–#71) la consuma sin reinventarla.

## Decisiones de brainstorming

| #   | Pregunta            | Decisión                                        | Por qué                                                                                                              |
| --- | ------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | Rama base           | **B** — desde `feature/3-schema-prisma`         | `PrismaService` necesita el schema (PR #82). El equipo es solo Angel ahora, así que apilar PRs es seguro.            |
| 2   | Alcance             | **C** — issue completa + todos los extras       | API queda lista para producción mínima desde el día 1. Los extras son baratos ahora, caros después.                  |
| 3   | Tests               | **C** — unit por componente + E2E + smoke       | Los componentes comunes son código que va a usar todo el equipo; tests aíslan regresiones.                           |
| 4   | Registro de globals | **Opción 2** — `APP_*` providers en `AppModule` | Los componentes globales necesitan DI (`PrismaService`, `Logger`, `Reflector`). Registrarlos en `main.ts` impide DI. |

## Estructura final de archivos

```
apps/api/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── nest-cli.json
├── jest.config.ts
├── jest.e2e.config.ts
├── .env                              (ya existe; ampliar variables)
├── .env.example                      (NUEVO, commiteable)
└── src/
    ├── main.ts
    ├── app.module.ts
    ├── config/
    │   ├── env.schema.ts             # Zod schema + validador del .env
    │   └── config.module.ts          # Re-exporta ConfigModule.forRoot
    ├── prisma/
    │   ├── prisma.module.ts          # @Global, exporta PrismaService
    │   └── prisma.service.ts         # extends PrismaClient, lifecycle hooks
    ├── health/
    │   ├── health.module.ts
    │   └── health.controller.ts      # GET /health → server + DB ping
    ├── common/
    │   ├── filters/
    │   │   ├── http-exception.filter.ts
    │   │   └── http-exception.filter.spec.ts
    │   ├── interceptors/
    │   │   ├── transform.interceptor.ts
    │   │   ├── transform.interceptor.spec.ts
    │   │   ├── logging.interceptor.ts
    │   │   └── logging.interceptor.spec.ts
    │   ├── guards/
    │   │   ├── roles.guard.ts        # stub funcional, completa #6 Auth
    │   │   └── roles.guard.spec.ts
    │   ├── decorators/
    │   │   ├── current-user.decorator.ts
    │   │   ├── current-user.decorator.spec.ts
    │   │   ├── roles.decorator.ts
    │   │   └── roles.decorator.spec.ts
    │   ├── types/
    │   │   └── request-user.ts       # tipo del user inyectado al request
    │   └── index.ts                  # barrel export
    └── test/
        └── app.e2e-spec.ts           # E2E: health, swagger, CORS, transform, filter, validation
```

**Notas:**

- `health/` es módulo propio (expone controller HTTP), no va dentro de `common/`.
- Tests viven al lado del archivo que prueban (`*.spec.ts`); E2E en `test/`.
- **No existe** `CommonModule`. Filters/interceptors/guards/decorators son providers/funciones sueltas, registradas globalmente desde `AppModule` (Opción 2). Crear un `CommonModule` sería ceremonia.
- `RolesGuard` queda **funcional** (lee metadata de `@Roles()` y compara contra `request.user.role`) pero asume que un guard previo (`JwtAuthGuard`, issue #6) ya pobló `request.user`.

## Bootstrap (`main.ts`)

```ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Logger pino reemplaza al Logger default de NestJS
  app.useLogger(app.get(Logger));

  // Seguridad y performance — orden importa: helmet antes de cualquier respuesta
  app.use(helmet());
  app.use(compression());

  // CORS desde env
  const config = app.get(ConfigService);
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }), // ya viene como string[]
    credentials: true,
  });

  // Prefix global + versionado URI; /health excluido del prefix
  app.setGlobalPrefix('api', { exclude: ['/health'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Swagger en /api/docs (condicional al env SWAGGER_ENABLED)
  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Gestión Académica API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(config.get('PORT', { infer: true }));
}
bootstrap();
```

`ValidationPipe`, filters, interceptors y throttler **NO** se registran aquí — van como `APP_*` providers en `AppModule` (necesitan DI). Helmet, compression, CORS, prefix, versioning y Swagger sí van en `main.ts` (no necesitan DI).

## `AppModule`

```ts
@Module({
  imports: [
    ConfigModule.forRoot({
      validate: validateEnv, // Zod
      isGlobal: true,
    }),
    LoggerModule.forRoot({
      // nestjs-pino
      pinoHttp: {
        transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    PrismaModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
```

**`RolesGuard` no se registra global** — es opt-in por endpoint con `@UseGuards(JwtAuthGuard, RolesGuard)`. Cuando llegue Auth (#6) se evalúa el cambio a global con `@Public()` para excluir login/register.

## Validación del `.env` con Zod

Toda variable se declara en un solo lugar. Si falta o es inválida, la app **no arranca**.

```ts
// apps/api/src/config/env.schema.ts
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),

  DATABASE_URL: z.string().url(),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((s) => s.split(',').map((o) => o.trim())),

  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SWAGGER_ENABLED: z.coerce.boolean().default(true),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${errors}`);
  }
  return result.data;
}
```

`JWT_*` y `THROTTLE_*` se declaran ahora aunque Auth todavía no exista — cuando llegue #6 no hay que tocar el schema.

### `.env.example`

```ini
NODE_ENV=development
PORT=3001

DATABASE_URL=postgresql://gestion_academica:devpassword@localhost:5432/gestion_academica

CORS_ORIGINS=http://localhost:3000,http://localhost:8081

JWT_SECRET=cambiar-por-secreto-de-32-chars-minimo-en-prod
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

THROTTLE_TTL_MS=60000
THROTTLE_LIMIT=100

LOG_LEVEL=info
SWAGGER_ENABLED=true
```

## Componentes comunes

### `HttpExceptionFilter`

Captura `@Catch()` (sin argumentos, captura todo). Convierte excepciones en formato uniforme:

```json
{
  "statusCode": 400,
  "message": "...",
  "error": "Bad Request",
  "timestamp": "2026-04-30T12:00:00.000Z",
  "path": "/api/v1/students"
}
```

- `HttpException` → usa su `getStatus()` y `getResponse()` (soporta el array de mensajes de class-validator).
- Cualquier otra excepción → 500 con mensaje genérico, stack loggeado pero **no expuesto** al cliente.

### `TransformInterceptor`

Envuelve toda respuesta exitosa en `{ data: T }`. Implementación trivial con `map`. Si en el futuro un endpoint necesita response crudo (descarga binaria), agregaremos un decorador `@SkipTransform()`. **No ahora** (YAGNI).

### `LoggingInterceptor`

Mide tiempo de respuesta y loggea método/url/ms vía pino. `nestjs-pino` ya loggea cada request por su cuenta, pero su log es a nivel HTTP (entrada/salida); este interceptor opera a nivel de **handler** y permite enriquecer el contexto con datos del dominio (cuando llegue Auth, agrega `userId`; en errores controlados, loggea como `warn` con el código HTTP en vez del `error` genérico de pino-http). Se mantiene en la PR final.

### `RolesGuard` (stub funcional)

```ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    return requiredRoles.includes(user.role);
  }
}
```

- Lee metadata de `@Roles()` y compara con `request.user.role`.
- Sin `@Roles()` → deja pasar.
- Sin `request.user` → rechaza.
- Asume que un guard previo (`JwtAuthGuard`, #6) populó `request.user`.

### Decoradores

```ts
// @Roles('ADMIN', 'DIRECTOR')
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

// @CurrentUser() user, o @CurrentUser('id') userId
export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest().user as RequestUser | undefined;
    return data && user ? user[data] : user;
  },
);
```

`Role` se importa de `packages/shared` (commit `512c393` en la rama `feature/3-schema-prisma`). No se re-declara aquí.

`RequestUser` es un tipo nuevo en `apps/api/src/common/types/request-user.ts`:

```ts
export type RequestUser = { id: string; email: string; role: Role };
```

Lo populará `JwtAuthGuard` cuando llegue #6.

## Prisma

```ts
// prisma/prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService<Env, true>) {
    super({
      datasources: { db: { url: config.get('DATABASE_URL', { infer: true }) } },
      log:
        config.get('NODE_ENV', { infer: true }) === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}

// prisma/prisma.module.ts
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

`@Global()` permite inyectar `PrismaService` desde cualquier módulo sin re-importar `PrismaModule`.

## Health check

```ts
// health/health.controller.ts
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: PrismaHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }
}
```

`PrismaHealthIndicator` es un wrapper trivial que ejecuta `SELECT 1`. Usa `@nestjs/terminus`. Queda fuera del prefix `/api/v1/` por convención (load balancers no deben saber versiones).

## Tests

### Unit (Jest, mocks)

| Archivo                          | Casos                                                                                                     |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `http-exception.filter.spec.ts`  | `HttpException` → formato uniforme; error genérico → 500 sin exponer stack; preserva `path` y `timestamp` |
| `transform.interceptor.spec.ts`  | string → `{ data: 'x' }`; array → `{ data: [...] }`; null → `{ data: null }`                              |
| `logging.interceptor.spec.ts`    | Loggea método/url/ms en éxito; loggea como warn en error y re-lanza                                       |
| `roles.guard.spec.ts`            | Sin `@Roles` → pasa; rol correcto → pasa; rol incorrecto → rechaza; sin user → rechaza                    |
| `current-user.decorator.spec.ts` | Devuelve `request.user`; con argumento `'id'` devuelve `user.id`; sin user → undefined                    |
| `roles.decorator.spec.ts`        | Metadata seteado correctamente                                                                            |

### E2E (Supertest, app real)

```
GET  /health                     → 200, { data: { status: 'ok', info: { database: 'up' } } }
GET  /api/docs                   → 200, content-type text/html (Swagger UI)
GET  /api/docs-json              → 200, JSON spec con título y bearer auth declarado
OPTIONS /api/v1/__ok (con Origin)→ headers CORS presentes y correctos
GET  /api/v1/__ok                → 200, body { data: 'ok' } (TransformInterceptor)
GET  /api/v1/__notfound          → 404, formato { statusCode, message, error, timestamp, path }
POST /api/v1/__validate          → con body inválido → 400 con array de errores
```

Los endpoints `__ok`, `__notfound`, `__validate` son **fixtures de testing**: viven en un `TestController` cargado **solo** en el módulo de test (`Test.createTestingModule({...}).overrideModule()`), no se exponen en producción.

### Cobertura objetivo

- 6 unit tests pasan
- 7 E2E pasan
- `pnpm test:cov --filter api` reporta ≥80% en `apps/api/src/common/`

## Criterios de aceptación

- [ ] `pnpm dev --filter api` levanta la API en puerto 3001
- [ ] `GET /health` responde 200 con DB conectada
- [ ] `GET /api/docs` muestra Swagger UI con bearer auth declarado
- [ ] Prisma conecta; `PrismaService` es inyectable en cualquier service
- [ ] Decoradores `@CurrentUser()`, `@Roles()` y `RolesGuard` exportados desde `common/`
- [ ] `pnpm test --filter api` pasa los 6 unit tests
- [ ] `pnpm test:e2e --filter api` pasa los 7 E2E tests
- [ ] CI en verde: Lint, Format, Type Check, Tests, Security Audit, Secrets Scan
- [ ] `.env.example` actualizado y commiteado
- [ ] Sin secretos en commits

## Fuera del alcance (queda para otras issues)

- ❌ JWT real / login / refresh tokens → **#6** (B1-06)
- ❌ `AuditInterceptor` real con writes a `audit_logs` → **#72** (B0-71)
- ❌ Migración de `@nestjs/throttler` a Redis-backed → cuando exista módulo de cache
- ❌ Health check de Redis/MinIO → cuando esos módulos existan
- ❌ Swagger detrás de auth en producción → decisión de despliegue futura
- ❌ Decorador `@SkipTransform()` para responses crudos (binarios) → cuando se necesite

## Dependencias y orden de merge

Esta rama está apilada sobre `feature/3-schema-prisma` (PR #82). En el momento de escribir el spec, **`main` aún no tiene** los archivos `CONTRIBUTING.md`, `ARCHITECTURE.md` ni `CODING_STYLE.md` (viven en `feature/82-documentacion-workflow`, PR #84). El spec los referencia como contexto de equipo asumiendo que estarán mergeados antes de que esta PR llegue a review.

Orden esperado de merge a `main`:

1. **PR #84** (`docs: workflow del equipo, arquitectura y estilo de código`) → mergea primero. Aporta convenciones que el equipo aplicará en review.
2. **PR #82** (`feat(db): schema Prisma`) → mergea segundo. Aporta el schema que `PrismaService` necesita.
3. **PR de esta issue (#4)** → una vez ambas estén en `main`, esta rama se actualiza a `main` (siguiendo la convención del repo, que hasta ahora ha usado _merge commits_ vía `gh pr merge`) y se abre PR contra `main`.

## Riesgos identificados

- **Riesgo:** PR #82 puede sufrir cambios en review que generen conflictos al rebasar.
  **Mitigación:** Angel es único reviewer/autor ahora; si hay cambios, se rebase manual antes de abrir PR de #4.
- **Riesgo:** `nestjs-pino` versión incompatible con la versión de NestJS que se instale.
  **Mitigación:** instalar versiones explícitas en el plan, validar con `pnpm install` antes de escribir código.
- **Riesgo:** `nest new` no funciona limpio en pnpm workspace; hay que armar la estructura manualmente.
  **Mitigación:** el plan de implementación detallará el orden exacto de archivos a crear; no se usa `nest new`.
