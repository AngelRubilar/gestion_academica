# Config Base NestJS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir los cimientos comunes del backend NestJS (config tipada con Zod, Prisma global, exception filter uniforme, transform interceptor `{data}`, logging interceptor, roles guard stub, decoradores `@CurrentUser` y `@Roles`, validation pipe, throttler, helmet/compression/CORS, prefix `/api/v1` con versionado, healthcheck con DB ping y Swagger en `/api/docs`) sobre los que cualquier CRUD posterior se construirá.

**Architecture:** App NestJS 11 en `apps/api/` con `nestjs-pino` como logger, Prisma 7 ya instalado (de PR #82) montado como módulo global. Los componentes globales se registran como `APP_*` providers en `AppModule` para preservar inyección de dependencias. `main.ts` se reserva para configuración no-DI (helmet, compression, CORS, prefix, versioning, Swagger).

**Tech Stack:** NestJS 11 · TypeScript 5.9 · Prisma 7 · Zod 3.24 · nestjs-pino + pino-pretty · @nestjs/throttler · @nestjs/swagger · @nestjs/terminus · class-validator · helmet · compression · Jest 29 · Supertest

**Spec:** `docs/superpowers/specs/2026-04-30-config-base-nestjs-design.md`

**Branch:** `feature/4-config-base-nestjs` (apilada sobre `feature/3-schema-prisma`)

---

## Pre-requisitos

- PostgreSQL corriendo localmente en `localhost:5432` con la BD `gestion_academica` (Docker dev compose la levanta).
- Node ≥22, pnpm 10.33.0.
- Antes de empezar: `pnpm install` desde la raíz, y `pnpm --filter api prisma:generate` para generar el cliente Prisma.

## File map

**Modificar:**
- `apps/api/package.json` — añadir deps NestJS y reemplazar scripts placeholder
- `apps/api/tsconfig.json` — overrides para CommonJS y decoradores
- `apps/api/.env` — añadir variables nuevas
- `apps/api/.gitignore` — asegurar que ignora `dist/`

**Crear (root de la app):**
- `apps/api/tsconfig.build.json` — excluye tests del build
- `apps/api/nest-cli.json` — config del CLI de Nest
- `apps/api/jest.config.ts` — config de unit tests
- `apps/api/jest.e2e.config.ts` — config de E2E tests
- `apps/api/.env.example` — placeholder commiteable

**Crear (src):**
- `apps/api/src/main.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/config/env.schema.ts` (+ `.spec.ts`)
- `apps/api/src/prisma/prisma.module.ts`
- `apps/api/src/prisma/prisma.service.ts`
- `apps/api/src/health/health.module.ts`
- `apps/api/src/health/health.controller.ts`
- `apps/api/src/health/prisma.health.ts`
- `apps/api/src/common/types/request-user.ts`
- `apps/api/src/common/filters/http-exception.filter.ts` (+ `.spec.ts`)
- `apps/api/src/common/interceptors/transform.interceptor.ts` (+ `.spec.ts`)
- `apps/api/src/common/interceptors/logging.interceptor.ts` (+ `.spec.ts`)
- `apps/api/src/common/guards/roles.guard.ts` (+ `.spec.ts`)
- `apps/api/src/common/decorators/current-user.decorator.ts` (+ `.spec.ts`)
- `apps/api/src/common/decorators/roles.decorator.ts` (+ `.spec.ts`)
- `apps/api/src/common/index.ts`

**Crear (test E2E):**
- `apps/api/test/jest-e2e.json` — opcional, alternativa a `.config.ts`
- `apps/api/test/test-fixtures.module.ts` — `TestController` con `__ok`, `__notfound`, `__validate`
- `apps/api/test/app.e2e-spec.ts`

---

## Convenciones del plan

- **Commit messages:** seguir `feat(api): ...`, `test(api): ...`, `chore(api): ...`, `refactor(api): ...` (estilo conventional commits, ya usado en el repo).
- **Comandos:** ejecutar desde la raíz del monorepo. Los filters de Turborepo (`--filter api`) seleccionan la app correcta.
- **Tests:** un `.spec.ts` al lado del archivo. E2E va en `apps/api/test/`. Después de implementar cada componente, los tests deben pasar antes de commit.
- **No usar `nest new`:** la app vive dentro del monorepo pnpm; armamos los archivos manualmente.

---

### Task 1: Instalar dependencias y archivos de configuración

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/tsconfig.json`
- Create: `apps/api/tsconfig.build.json`
- Create: `apps/api/nest-cli.json`
- Create: `apps/api/jest.config.ts`
- Create: `apps/api/jest.e2e.config.ts`
- Modify: `apps/api/.gitignore`

- [ ] **Step 1: Reemplazar `apps/api/package.json` con dependencias reales y scripts**

```json
{
  "name": "@gestion-academica/api",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "nest start --watch",
    "start": "node dist/main.js",
    "build": "nest build",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\"",
    "test": "jest --config jest.config.ts",
    "test:watch": "jest --config jest.config.ts --watch",
    "test:cov": "jest --config jest.config.ts --coverage",
    "test:e2e": "jest --config jest.e2e.config.ts --runInBand",
    "prisma:migrate": "prisma migrate dev",
    "prisma:generate": "prisma generate",
    "prisma:seed": "ts-node --transpile-only prisma/seed.ts",
    "prisma:studio": "prisma studio"
  },
  "dependencies": {
    "@gestion-academica/shared": "workspace:*",
    "@nestjs/common": "^11.0.0",
    "@nestjs/config": "^4.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "@nestjs/swagger": "^11.0.0",
    "@nestjs/terminus": "^11.0.0",
    "@nestjs/throttler": "^6.0.0",
    "@prisma/adapter-pg": "^7.8.0",
    "@prisma/client": "^7.6.0",
    "@types/pg": "^8.20.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "compression": "^1.7.5",
    "dotenv": "^17.4.2",
    "helmet": "^8.0.0",
    "nestjs-pino": "^4.3.0",
    "pg": "^8.20.0",
    "pino": "^9.5.0",
    "pino-http": "^10.3.0",
    "pino-pretty": "^11.3.0",
    "prisma": "^7.6.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@nestjs/testing": "^11.0.0",
    "@types/bcrypt": "^6.0.0",
    "@types/compression": "^1.7.5",
    "@types/express": "^5.0.0",
    "@types/jest": "^29.5.14",
    "@types/node": "^25.6.0",
    "@types/supertest": "^6.0.2",
    "bcrypt": "^6.0.0",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-loader": "^9.5.2",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 2: Reemplazar `apps/api/tsconfig.json`** (overrides para NestJS sobre el root `tsconfig.json` que usa ESNext+bundler — incompatible con NestJS)

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "target": "ES2022",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "baseUrl": "./",
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": false,
    "declaration": false,
    "declarationMap": false
  },
  "include": ["src/**/*", "test/**/*"],
  "exclude": ["node_modules", "dist", "prisma"]
}
```

**Nota:** no se setea `rootDir` aquí para que ts-jest pueda compilar tanto `src/` como `test/`. El `rootDir` del build (que define dónde sale `dist/main.js`) va en `tsconfig.build.json`.

- [ ] **Step 3: Crear `apps/api/tsconfig.build.json`** (excluye tests y fija rootDir para que la salida quede en `dist/main.js` y no `dist/src/main.js`)

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "test", "dist", "**/*.spec.ts", "prisma"]
}
```

- [ ] **Step 4: Crear `apps/api/nest-cli.json`**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "tsConfigPath": "tsconfig.build.json"
  }
}
```

- [ ] **Step 5: Crear `apps/api/jest.config.ts`** (unit tests)

```ts
import type { Config } from 'jest';

const config: Config = {
  rootDir: '.',
  testRegex: 'src/.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/main.ts'],
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
};

export default config;
```

- [ ] **Step 6: Crear `apps/api/jest.e2e.config.ts`** (E2E tests)

```ts
import type { Config } from 'jest';

const config: Config = {
  rootDir: '.',
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testEnvironment: 'node',
  testTimeout: 30000,
};

export default config;
```

- [ ] **Step 7: Asegurar `apps/api/.gitignore` ignora `dist/`, `coverage/`, `*.tsbuildinfo`**

Si el archivo no existe o no incluye estas líneas, agregarlas:

```
dist/
coverage/
*.tsbuildinfo
.env
```

(`.env` ya debería estar; verificar.)

- [ ] **Step 8: Instalar dependencias**

Run: `pnpm install`
Expected: pnpm-lock.yaml se actualiza, `node_modules` se instala sin errores. Si reporta peer-dep warnings sobre TypeScript, son aceptables.

- [ ] **Step 9: Generar el cliente Prisma**

Run: `pnpm --filter api prisma:generate`
Expected: `Generated Prisma Client (X.X.X) to ./node_modules/@prisma/client`

- [ ] **Step 10: Commit**

```bash
git add apps/api/package.json apps/api/tsconfig.json apps/api/tsconfig.build.json \
        apps/api/nest-cli.json apps/api/jest.config.ts apps/api/jest.e2e.config.ts \
        apps/api/.gitignore pnpm-lock.yaml
git commit -m "chore(api): instalar dependencias NestJS y configurar build/test"
```

---

### Task 2: Bootstrap mínimo (humo)

Objetivo: dejar la API arrancando en puerto 3001 sin nada más, para validar que la cadena `nest start` → `tsc` → Node funciona antes de agregar lógica.

**Files:**
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`

- [ ] **Step 1: Crear `apps/api/src/app.module.ts` mínimo**

```ts
import { Module } from '@nestjs/common';

@Module({
  imports: [],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

- [ ] **Step 2: Crear `apps/api/src/main.ts` mínimo**

```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API escuchando en puerto ${port}`);
}
bootstrap();
```

- [ ] **Step 3: Levantar el dev server (smoke test manual)**

Run: `pnpm --filter api dev`
Expected: log `API escuchando en puerto 3001`, sin errores. Detener con Ctrl-C.

- [ ] **Step 4: Build de producción funciona**

Run: `pnpm --filter api build`
Expected: genera `apps/api/dist/main.js` sin errores TypeScript.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/main.ts apps/api/src/app.module.ts
git commit -m "feat(api): bootstrap mínimo de NestJS"
```

---

### Task 3: Validación del `.env` con Zod

**Files:**
- Create: `apps/api/src/config/env.schema.ts`
- Create: `apps/api/src/config/env.schema.spec.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/.env`
- Create: `apps/api/.env.example`

- [ ] **Step 1: Escribir `apps/api/src/config/env.schema.spec.ts` (test que falla)**

```ts
import { validateEnv } from './env.schema';

describe('validateEnv', () => {
  const baseEnv = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_SECRET: 'a-secret-with-at-least-32-characters-long-x',
  };

  it('parsea valores válidos y aplica defaults', () => {
    const result = validateEnv(baseEnv);
    expect(result.NODE_ENV).toBe('development');
    expect(result.PORT).toBe(3001);
    expect(result.CORS_ORIGINS).toEqual(['http://localhost:3000']);
    expect(result.LOG_LEVEL).toBe('info');
    expect(result.SWAGGER_ENABLED).toBe(true);
  });

  it('coerce PORT a number', () => {
    const result = validateEnv({ ...baseEnv, PORT: '4000' });
    expect(result.PORT).toBe(4000);
    expect(typeof result.PORT).toBe('number');
  });

  it('parsea CORS_ORIGINS como array separado por coma', () => {
    const result = validateEnv({
      ...baseEnv,
      CORS_ORIGINS: 'http://localhost:3000, http://localhost:8081',
    });
    expect(result.CORS_ORIGINS).toEqual([
      'http://localhost:3000',
      'http://localhost:8081',
    ]);
  });

  it('falla si DATABASE_URL está ausente', () => {
    expect(() =>
      validateEnv({ JWT_SECRET: baseEnv.JWT_SECRET } as unknown as Record<string, unknown>),
    ).toThrow(/DATABASE_URL/);
  });

  it('falla si JWT_SECRET es menor a 32 caracteres', () => {
    expect(() => validateEnv({ ...baseEnv, JWT_SECRET: 'corto' })).toThrow(/JWT_SECRET/);
  });

  it('falla con NODE_ENV inválido', () => {
    expect(() => validateEnv({ ...baseEnv, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `pnpm --filter api test -- env.schema.spec`
Expected: FAIL — `Cannot find module './env.schema'`.

- [ ] **Step 3: Implementar `apps/api/src/config/env.schema.ts`**

```ts
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),

  DATABASE_URL: z.string().url(),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),

  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  SWAGGER_ENABLED: z.coerce.boolean().default(true),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  - ${e.path.join('.') || '(root)'}: ${e.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${errors}`);
  }
  return result.data;
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `pnpm --filter api test -- env.schema.spec`
Expected: PASS — 6 tests OK.

- [ ] **Step 5: Wire `ConfigModule` en `app.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

- [ ] **Step 6: Actualizar `apps/api/.env` con las variables nuevas**

```ini
NODE_ENV=development
PORT=3001

DATABASE_URL=postgresql://gestion_academica:devpassword@localhost:5432/gestion_academica

CORS_ORIGINS=http://localhost:3000,http://localhost:8081

JWT_SECRET=dev-jwt-secret-change-me-in-production-32chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

THROTTLE_TTL_MS=60000
THROTTLE_LIMIT=100

LOG_LEVEL=info
SWAGGER_ENABLED=true
```

- [ ] **Step 7: Crear `apps/api/.env.example`** (placeholder commiteable)

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

- [ ] **Step 8: Smoke test — la app arranca con env válido**

Run: `pnpm --filter api dev`
Expected: arranca sin errores. Detener con Ctrl-C.

- [ ] **Step 9: Smoke test — la app falla con env inválido**

Run: `JWT_SECRET=short pnpm --filter api dev`
Expected: arroja `Invalid environment variables:` y sale con código distinto de 0.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/config apps/api/src/app.module.ts apps/api/.env apps/api/.env.example
git commit -m "feat(api): validación tipada del .env con Zod"
```

---

### Task 4: PrismaModule global y PrismaService

**Files:**
- Create: `apps/api/src/prisma/prisma.service.ts`
- Create: `apps/api/src/prisma/prisma.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Crear `apps/api/src/prisma/prisma.service.ts`**

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import type { Env } from '../config/env.schema';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService<Env, true>) {
    super({
      datasources: {
        db: { url: config.get('DATABASE_URL', { infer: true }) },
      },
      log:
        config.get('NODE_ENV', { infer: true }) === 'development'
          ? ['warn', 'error']
          : ['error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

- [ ] **Step 2: Crear `apps/api/src/prisma/prisma.module.ts`**

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 3: Importar `PrismaModule` en `AppModule`**

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.schema';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

- [ ] **Step 4: Smoke test — la app conecta a la BD**

Run: `pnpm --filter api dev`
Expected: arranca sin errores. Si la BD no está levantada (Docker), Prisma logueará un error de conexión y se detendrá. Levantar con `docker compose -f docker/dev/docker-compose.yml up -d postgres` si hace falta.

- [ ] **Step 5: Build sigue verde**

Run: `pnpm --filter api build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/prisma apps/api/src/app.module.ts
git commit -m "feat(api): PrismaModule global con lifecycle hooks"
```

---

### Task 5: HttpExceptionFilter

**Files:**
- Create: `apps/api/src/common/filters/http-exception.filter.ts`
- Create: `apps/api/src/common/filters/http-exception.filter.spec.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Escribir el spec (TDD)**

```ts
// apps/api/src/common/filters/http-exception.filter.spec.ts
import { ArgumentsHost, BadRequestException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function makeHost(req: { url?: string } = {}) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };
  const request = { url: req.url ?? '/test' };
  const host: Partial<ArgumentsHost> = {
    switchToHttp: () =>
      ({
        getResponse: () => response,
        getRequest: () => request,
      }) as never,
  };
  return { host: host as ArgumentsHost, status, json };
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  it('transforma HttpException en formato uniforme', () => {
    const { host, status, json } = makeHost({ url: '/api/v1/x' });
    const exc = new NotFoundException('No existe');

    filter.catch(exc, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No existe',
        error: 'Not Found',
        path: '/api/v1/x',
        timestamp: expect.stringMatching(/\d{4}-\d{2}-\d{2}T/),
      }),
    );
  });

  it('preserva el array de mensajes de class-validator', () => {
    const { host, json } = makeHost();
    const exc = new BadRequestException({
      message: ['email must be an email', 'name should not be empty'],
      error: 'Bad Request',
      statusCode: 400,
    });

    filter.catch(exc, host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: ['email must be an email', 'name should not be empty'],
        error: 'Bad Request',
      }),
    );
  });

  it('convierte error genérico en 500 sin exponer stack', () => {
    const { host, status, json } = makeHost({ url: '/foo' });
    const exc = new Error('boom');

    filter.catch(exc, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = json.mock.calls[0][0];
    expect(body.statusCode).toBe(500);
    expect(body.message).toBe('Internal server error');
    expect(body.error).toBe('Internal Server Error');
    expect(body).not.toHaveProperty('stack');
  });

  it('maneja HttpException con response como string', () => {
    const { host, json } = makeHost();
    const exc = new HttpException('error simple', HttpStatus.FORBIDDEN);

    filter.catch(exc, host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: 'error simple',
      }),
    );
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `pnpm --filter api test -- http-exception.filter`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar el filter**

```ts
// apps/api/src/common/filters/http-exception.filter.ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
        error = exception.name.replace(/Exception$/, '');
      } else {
        const obj = res as { message?: string | string[]; error?: string };
        message = obj.message ?? exception.message;
        error = obj.error ?? exception.name.replace(/Exception$/, '');
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    } else {
      this.logger.error(`Unknown exception thrown: ${String(exception)}`);
    }

    const body: ErrorBody = {
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(body);
  }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `pnpm --filter api test -- http-exception.filter`
Expected: PASS — 4 tests OK.

- [ ] **Step 5: Registrar como `APP_FILTER` en `AppModule`**

```ts
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.schema';
import { PrismaModule } from './prisma/prisma.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
```

- [ ] **Step 6: Build y test suite verde**

Run: `pnpm --filter api build && pnpm --filter api test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/common/filters apps/api/src/app.module.ts
git commit -m "feat(api): HttpExceptionFilter global con formato uniforme"
```

---

### Task 6: TransformInterceptor

**Files:**
- Create: `apps/api/src/common/interceptors/transform.interceptor.ts`
- Create: `apps/api/src/common/interceptors/transform.interceptor.spec.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Escribir el spec (TDD)**

```ts
// apps/api/src/common/interceptors/transform.interceptor.spec.ts
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;

  const ctxStub = {} as ExecutionContext;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  async function intercept(value: unknown): Promise<unknown> {
    const handler: CallHandler = { handle: () => of(value) };
    return firstValueFrom(interceptor.intercept(ctxStub, handler));
  }

  it('envuelve un string en {data}', async () => {
    expect(await intercept('hola')).toEqual({ data: 'hola' });
  });

  it('envuelve un array en {data}', async () => {
    expect(await intercept([1, 2, 3])).toEqual({ data: [1, 2, 3] });
  });

  it('envuelve null en {data: null}', async () => {
    expect(await intercept(null)).toEqual({ data: null });
  });

  it('envuelve un objeto en {data}', async () => {
    expect(await intercept({ id: 1 })).toEqual({ data: { id: 1 } });
  });
});
```

- [ ] **Step 2: Correr el test (FAIL)**

Run: `pnpm --filter api test -- transform.interceptor`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar el interceptor**

```ts
// apps/api/src/common/interceptors/transform.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ResponseEnvelope<T> {
  data: T;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ResponseEnvelope<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ResponseEnvelope<T>> {
    return next.handle().pipe(map((data) => ({ data })));
  }
}
```

- [ ] **Step 4: Correr el test (PASS)**

Run: `pnpm --filter api test -- transform.interceptor`
Expected: PASS — 4 tests OK.

- [ ] **Step 5: Registrar como `APP_INTERCEPTOR`**

En `app.module.ts`, agregar import y provider:

```ts
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

// ... dentro de providers:
providers: [
  { provide: APP_FILTER, useClass: HttpExceptionFilter },
  { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
],
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/common/interceptors/transform.interceptor.ts \
        apps/api/src/common/interceptors/transform.interceptor.spec.ts \
        apps/api/src/app.module.ts
git commit -m "feat(api): TransformInterceptor envuelve respuestas en {data}"
```

---

### Task 7: nestjs-pino + LoggingInterceptor

**Files:**
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/main.ts`
- Create: `apps/api/src/common/interceptors/logging.interceptor.ts`
- Create: `apps/api/src/common/interceptors/logging.interceptor.spec.ts`

- [ ] **Step 1: Importar `LoggerModule` en `AppModule`**

Agregar al inicio de imports:

```ts
import { LoggerModule } from 'nestjs-pino';

// dentro de imports[] del @Module:
LoggerModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>) => ({
    pinoHttp: {
      level: config.get('LOG_LEVEL', { infer: true }),
      transport:
        config.get('NODE_ENV', { infer: true }) === 'development'
          ? { target: 'pino-pretty', options: { singleLine: true } }
          : undefined,
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie'],
        censor: '[REDACTED]',
      },
    },
  }),
}),
```

Asegurar que `ConfigService` y `Env` están importados en el archivo:

```ts
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { Env } from './config/env.schema';
```

- [ ] **Step 2: Reemplazar el logger default en `main.ts`**

```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}
bootstrap();
```

- [ ] **Step 3: Smoke — el dev server arranca y loguea con pino-pretty**

Run: `pnpm --filter api dev`
Expected: logs ahora aparecen con timestamp y formato pino. Detener con Ctrl-C.

- [ ] **Step 4: Escribir el spec del LoggingInterceptor (TDD)**

```ts
// apps/api/src/common/interceptors/logging.interceptor.spec.ts
import { CallHandler, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

function makeContext(req: { method: string; url: string }) {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('LoggingInterceptor', () => {
  let logger: { setContext: jest.Mock; info: jest.Mock; warn: jest.Mock; error: jest.Mock };
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    interceptor = new LoggingInterceptor(logger as never);
  });

  it('loguea método/url/ms en éxito', async () => {
    const ctx = makeContext({ method: 'GET', url: '/foo' });
    const handler: CallHandler = { handle: () => of('ok') };

    await firstValueFrom(interceptor.intercept(ctx, handler));

    expect(logger.info).toHaveBeenCalledTimes(1);
    const arg = logger.info.mock.calls[0][0];
    expect(arg).toMatchObject({ method: 'GET', url: '/foo', status: 'ok' });
    expect(typeof arg.ms).toBe('number');
  });

  it('loguea como warn en HttpException y re-lanza', async () => {
    const ctx = makeContext({ method: 'POST', url: '/bar' });
    const exc = new HttpException('nope', HttpStatus.FORBIDDEN);
    const handler: CallHandler = { handle: () => throwError(() => exc) };

    await expect(
      firstValueFrom(interceptor.intercept(ctx, handler)),
    ).rejects.toBe(exc);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][0]).toMatchObject({
      method: 'POST',
      url: '/bar',
      status: 'err',
      code: 403,
    });
  });

  it('loguea como error en excepción no HTTP y re-lanza', async () => {
    const ctx = makeContext({ method: 'GET', url: '/baz' });
    const exc = new Error('boom');
    const handler: CallHandler = { handle: () => throwError(() => exc) };

    await expect(
      firstValueFrom(interceptor.intercept(ctx, handler)),
    ).rejects.toBe(exc);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 5: Correr el test (FAIL)**

Run: `pnpm --filter api test -- logging.interceptor`
Expected: FAIL — módulo no existe.

- [ ] **Step 6: Implementar el interceptor**

```ts
// apps/api/src/common/interceptors/logging.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext('HTTP');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ method: string; url: string }>();
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.logger.info({
          method: req.method,
          url: req.url,
          ms: Date.now() - start,
          status: 'ok',
        });
      }),
      catchError((err: unknown) => {
        if (err instanceof HttpException) {
          this.logger.warn({
            method: req.method,
            url: req.url,
            ms: Date.now() - start,
            status: 'err',
            code: err.getStatus(),
          });
        } else {
          this.logger.error({
            method: req.method,
            url: req.url,
            ms: Date.now() - start,
            status: 'err',
            err,
          });
        }
        return throwError(() => err);
      }),
    );
  }
}
```

**Nota:** `PinoLogger.setContext()` se llama en el constructor, por eso el mock incluye `setContext: jest.fn()`. Si se omitiera, el test fallaría con `TypeError: this.logger.setContext is not a function`.

- [ ] **Step 7: Correr el test (PASS)**

Run: `pnpm --filter api test -- logging.interceptor`
Expected: PASS — 3 tests OK.

- [ ] **Step 8: Registrar como `APP_INTERCEPTOR`**

En `app.module.ts`:

```ts
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

// agregar a providers:
{ provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
```

El orden importa: `LoggingInterceptor` debe registrarse **antes** que `TransformInterceptor` para que loguee la respuesta cruda (antes de envolverla en `{data}`). Los APP_INTERCEPTOR ejecutan en orden de declaración para entrada y orden inverso para salida.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/main.ts apps/api/src/app.module.ts \
        apps/api/src/common/interceptors/logging.interceptor.ts \
        apps/api/src/common/interceptors/logging.interceptor.spec.ts
git commit -m "feat(api): logger pino y LoggingInterceptor"
```

---

### Task 8: Roles decorator + RolesGuard + CurrentUser decorator

**Files:**
- Create: `apps/api/src/common/types/request-user.ts`
- Create: `apps/api/src/common/decorators/roles.decorator.ts`
- Create: `apps/api/src/common/decorators/roles.decorator.spec.ts`
- Create: `apps/api/src/common/guards/roles.guard.ts`
- Create: `apps/api/src/common/guards/roles.guard.spec.ts`
- Create: `apps/api/src/common/decorators/current-user.decorator.ts`
- Create: `apps/api/src/common/decorators/current-user.decorator.spec.ts`

**Pre-condición:** El enum `Role` debe estar exportado en `packages/shared` (commit `512c393` de PR #82). Verificar:

Run: `grep -n "Role" packages/shared/src/constants.ts packages/shared/src/types.ts`
Expected: Aparece la definición de `Role` (string enum con SUPER_ADMIN, ADMIN, DIRECTOR, etc.).

Si no existe, crear el enum mínimo en `apps/api/src/common/types/request-user.ts` (ver Step 1) y abrir issue de seguimiento. **Asume que sí existe.**

- [ ] **Step 1: Crear `apps/api/src/common/types/request-user.ts`**

```ts
import type { Role } from '@gestion-academica/shared';

export interface RequestUser {
  id: string;
  email: string;
  role: Role;
}
```

- [ ] **Step 2: Crear el decorador `@Roles()` y su spec (TDD)**

```ts
// apps/api/src/common/decorators/roles.decorator.spec.ts
import { Reflector } from '@nestjs/core';
import { Roles, ROLES_KEY } from './roles.decorator';

describe('Roles decorator', () => {
  it('setea metadata con la lista de roles', () => {
    class Dummy {
      @Roles('ADMIN' as never, 'DIRECTOR' as never)
      handler() {}
    }
    const reflector = new Reflector();
    const value = reflector.get<string[]>(ROLES_KEY, Dummy.prototype.handler);
    expect(value).toEqual(['ADMIN', 'DIRECTOR']);
  });
});
```

Run: `pnpm --filter api test -- roles.decorator`
Expected: FAIL — módulo no existe.

```ts
// apps/api/src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import type { Role } from '@gestion-academica/shared';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
```

Run: `pnpm --filter api test -- roles.decorator`
Expected: PASS.

- [ ] **Step 3: Crear `RolesGuard` y su spec (TDD)**

```ts
// apps/api/src/common/guards/roles.guard.spec.ts
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

function makeCtx(user: unknown) {
  return {
    getHandler: () => () => undefined,
    getClass: () => function Cls() {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  function makeGuard(metadata: unknown) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(metadata),
    } as unknown as Reflector;
    return { guard: new RolesGuard(reflector), reflector };
  }

  it('deja pasar si no hay metadata @Roles', () => {
    const { guard } = makeGuard(undefined);
    expect(guard.canActivate(makeCtx({ id: '1', role: 'ESTUDIANTE' }))).toBe(true);
  });

  it('deja pasar si el array de roles está vacío', () => {
    const { guard } = makeGuard([]);
    expect(guard.canActivate(makeCtx({ id: '1', role: 'ESTUDIANTE' }))).toBe(true);
  });

  it('rechaza si no hay user en el request', () => {
    const { guard } = makeGuard(['ADMIN']);
    expect(guard.canActivate(makeCtx(undefined))).toBe(false);
  });

  it('rechaza si el rol del user no está en la lista permitida', () => {
    const { guard } = makeGuard(['ADMIN', 'DIRECTOR']);
    expect(guard.canActivate(makeCtx({ id: '1', role: 'ESTUDIANTE' }))).toBe(false);
  });

  it('deja pasar si el rol del user está en la lista permitida', () => {
    const { guard } = makeGuard(['ADMIN', 'DIRECTOR']);
    expect(guard.canActivate(makeCtx({ id: '1', role: 'ADMIN' }))).toBe(true);
  });

  it('llama a getAllAndOverride con la key correcta y los targets correctos', () => {
    const { guard, reflector } = makeGuard(undefined);
    const ctx = makeCtx({ id: '1', role: 'ADMIN' });
    guard.canActivate(ctx);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
  });
});
```

Run: `pnpm --filter api test -- roles.guard`
Expected: FAIL.

```ts
// apps/api/src/common/guards/roles.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@gestion-academica/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { RequestUser } from '../types/request-user';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;
    if (!user) return false;

    return requiredRoles.includes(user.role);
  }
}
```

Run: `pnpm --filter api test -- roles.guard`
Expected: PASS — 6 tests OK.

- [ ] **Step 4: Crear `@CurrentUser()` y su spec (TDD)**

```ts
// apps/api/src/common/decorators/current-user.decorator.spec.ts
import { ExecutionContext } from '@nestjs/common';
import { extractCurrentUser } from './current-user.decorator';

function makeCtx(user: unknown) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('CurrentUser decorator (extractor)', () => {
  it('devuelve request.user completo cuando no hay argumento', () => {
    const user = { id: 'u1', email: 'a@b.cl', role: 'ADMIN' };
    expect(extractCurrentUser(undefined, makeCtx(user))).toEqual(user);
  });

  it('devuelve solo el campo solicitado cuando se pasa un nombre', () => {
    const user = { id: 'u1', email: 'a@b.cl', role: 'ADMIN' };
    expect(extractCurrentUser('id', makeCtx(user))).toBe('u1');
  });

  it('devuelve undefined si no hay user en el request', () => {
    expect(extractCurrentUser(undefined, makeCtx(undefined))).toBeUndefined();
  });

  it('devuelve undefined si hay user pero el campo no existe', () => {
    expect(extractCurrentUser('nope' as never, makeCtx({ id: 'x' }))).toBeUndefined();
  });
});
```

Run: `pnpm --filter api test -- current-user.decorator`
Expected: FAIL.

```ts
// apps/api/src/common/decorators/current-user.decorator.ts
import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { RequestUser } from '../types/request-user';

export function extractCurrentUser(
  data: keyof RequestUser | undefined,
  ctx: ExecutionContext,
): RequestUser | RequestUser[keyof RequestUser] | undefined {
  const request = ctx.switchToHttp().getRequest<{ user?: RequestUser }>();
  const user = request.user;
  if (!user) return undefined;
  return data ? user[data] : user;
}

export const CurrentUser = createParamDecorator(extractCurrentUser);
```

Run: `pnpm --filter api test -- current-user.decorator`
Expected: PASS — 4 tests OK.

- [ ] **Step 5: Build verde y commit**

Run: `pnpm --filter api build && pnpm --filter api test`
Expected: PASS.

```bash
git add apps/api/src/common/types apps/api/src/common/decorators apps/api/src/common/guards
git commit -m "feat(api): decoradores @Roles, @CurrentUser y RolesGuard stub"
```

---

### Task 9: ValidationPipe global

**Files:**
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Registrar `ValidationPipe` como `APP_PIPE`**

En `app.module.ts`, agregar import y provider:

```ts
import { ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';

// dentro de providers, primer item:
{
  provide: APP_PIPE,
  useValue: new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }),
},
```

- [ ] **Step 2: Build sigue verde**

Run: `pnpm --filter api build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/app.module.ts
git commit -m "feat(api): ValidationPipe global con whitelist y transform"
```

---

### Task 10: ThrottlerModule global

**Files:**
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Importar `ThrottlerModule` y registrar `ThrottlerGuard` como `APP_GUARD`**

```ts
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';

// en imports[]:
ThrottlerModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>) => [
    {
      ttl: config.get('THROTTLE_TTL_MS', { infer: true }),
      limit: config.get('THROTTLE_LIMIT', { infer: true }),
    },
  ],
}),

// en providers[]:
{ provide: APP_GUARD, useClass: ThrottlerGuard },
```

- [ ] **Step 2: Build verde y commit**

Run: `pnpm --filter api build`
Expected: PASS.

```bash
git add apps/api/src/app.module.ts
git commit -m "feat(api): rate limiting global con ThrottlerModule"
```

---

### Task 11: Helmet + compression + CORS + prefix + versioning en `main.ts`

**Files:**
- Modify: `apps/api/src/main.ts`

- [ ] **Step 1: Reemplazar `main.ts` con la configuración completa de bootstrap (sin Swagger, que se agrega en Task 12)**

```ts
import 'reflect-metadata';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import compression from 'compression';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import type { Env } from './config/env.schema';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  app.use(helmet());
  app.use(compression());

  const config = app.get(ConfigService) as ConfigService<Env, true>;

  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
  });

  app.setGlobalPrefix('api', { exclude: ['/health'] });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
}
bootstrap();
```

**Nota sobre tipos:** `helmet` y `compression` se importan como default. Si TypeScript se queja por `esModuleInterop`, los `@types/compression` y la propia tipificación de `helmet` lo resuelven.

- [ ] **Step 2: Smoke — el dev server arranca y responde con headers de seguridad**

Run: `pnpm --filter api dev`
En otra terminal:
```bash
curl -i http://localhost:3001/api/v1/__nope
```
Expected:
- Status `404`
- Header `X-DNS-Prefetch-Control: off` (helmet)
- Header `Content-Encoding: gzip` (compression — solo si el response es grande, en 404 puede no aparecer)
- Body: JSON con formato `{statusCode:404, message:..., timestamp:..., path:"/api/v1/__nope"}`

- [ ] **Step 3: Build verde y commit**

```bash
git add apps/api/src/main.ts
git commit -m "feat(api): helmet, compression, CORS, prefix /api/v1 con versionado"
```

---

### Task 12: Swagger en `/api/docs`

**Files:**
- Modify: `apps/api/src/main.ts`

- [ ] **Step 1: Agregar setup de Swagger condicional en `main.ts`**

Insertar **antes de `app.listen()`**:

```ts
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// ... dentro de bootstrap(), después de enableVersioning():
if (config.get('SWAGGER_ENABLED', { infer: true })) {
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
```

- [ ] **Step 2: Smoke — Swagger UI responde**

Run: `pnpm --filter api dev`
En el navegador o con curl:
```bash
curl -i http://localhost:3001/api/docs-json | head -20
```
Expected: JSON con `openapi: "3.0.0"`, `info.title: "Gestión Académica API"`, `components.securitySchemes.bearer`.

Y `http://localhost:3001/api/docs` muestra la UI de Swagger.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/main.ts
git commit -m "feat(api): Swagger UI en /api/docs con bearer auth"
```

---

### Task 13: HealthModule con DB ping

**Files:**
- Create: `apps/api/src/health/prisma.health.ts`
- Create: `apps/api/src/health/health.controller.ts`
- Create: `apps/api/src/health/health.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Crear el indicador custom de Prisma**

```ts
// apps/api/src/health/prisma.health.ts
import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (err) {
      throw new HealthCheckError(
        `${key} ping failed`,
        this.getStatus(key, false, { message: (err as Error).message }),
      );
    }
  }
}
```

- [ ] **Step 2: Crear el controller**

```ts
// apps/api/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma.health';

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

- [ ] **Step 3: Crear el módulo**

```ts
// apps/api/src/health/health.module.ts
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './prisma.health';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator],
})
export class HealthModule {}
```

- [ ] **Step 4: Importar `HealthModule` en `AppModule`**

```ts
import { HealthModule } from './health/health.module';

// dentro de imports[]:
HealthModule,
```

- [ ] **Step 5: Smoke — `/health` responde con DB up**

Run: `pnpm --filter api dev`
```bash
curl -s http://localhost:3001/health | jq
```
Expected:
```json
{
  "data": {
    "status": "ok",
    "info": { "database": { "status": "up" } },
    "error": {},
    "details": { "database": { "status": "up" } }
  }
}
```

(Nota: el envoltorio `{data: ...}` es por el `TransformInterceptor`. Si la respuesta del health saliera sin envolver, sería bug.)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/health apps/api/src/app.module.ts
git commit -m "feat(api): healthcheck en /health con ping a la DB"
```

---

### Task 14: Tests E2E

**Files:**
- Create: `apps/api/test/test-fixtures.module.ts`
- Create: `apps/api/test/app.e2e-spec.ts`

Estos tests levantan la app real con `Test.createTestingModule` y un módulo extra `TestFixturesModule` que expone `__ok`, `__notfound`, `__validate` para validar que los componentes globales funcionan end-to-end.

- [ ] **Step 1: Crear el módulo de fixtures de testing**

```ts
// apps/api/test/test-fixtures.module.ts
import { Body, Controller, Get, Module, Post } from '@nestjs/common';
import { IsEmail, IsNotEmpty } from 'class-validator';

class ValidatePayload {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  name!: string;
}

@Controller()
export class TestFixturesController {
  @Get('__ok')
  ok() {
    return 'ok';
  }

  @Post('__validate')
  validate(@Body() body: ValidatePayload) {
    return { received: body };
  }
}

@Module({
  controllers: [TestFixturesController],
})
export class TestFixturesModule {}
```

- [ ] **Step 2: Escribir los tests E2E**

```ts
// apps/api/test/app.e2e-spec.ts
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import compression from 'compression';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { TestFixturesModule } from './test-fixtures.module';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, TestFixturesModule],
    }).compile();

    app = moduleRef.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(Logger));
    app.use(helmet());
    app.use(compression());

    const config = app.get(ConfigService);
    app.enableCors({ origin: config.get('CORS_ORIGINS'), credentials: true });
    app.setGlobalPrefix('api', { exclude: ['/health'] });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health → 200 con DB up', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.info.database.status).toBe('up');
  });

  it('GET /api/docs-json → JSON spec con bearer auth declarado', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    expect(res.body.info.title).toBe('Gestión Académica API');
    expect(res.body.components.securitySchemes).toHaveProperty('bearer');
  });

  it('OPTIONS con Origin permitido → headers CORS presentes', async () => {
    const res = await request(app.getHttpServer())
      .options('/api/v1/__ok')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET')
      .expect((r) => {
        if (r.status >= 400 && r.status !== 204) throw new Error(`status ${r.status}`);
      });
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('GET /api/v1/__ok → 200 con cuerpo {data:"ok"}', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/__ok')
      .expect(200);
    expect(res.body).toEqual({ data: 'ok' });
  });

  it('GET /api/v1/__nope → 404 con formato uniforme', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/__nope')
      .expect(404);
    expect(res.body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      path: '/api/v1/__nope',
    });
    expect(res.body.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it('POST /api/v1/__validate con body inválido → 400 con errores', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/__validate')
      .send({ email: 'no-es-email', name: '' })
      .expect(400);
    expect(res.body.statusCode).toBe(400);
    expect(Array.isArray(res.body.message)).toBe(true);
    expect(res.body.message.length).toBeGreaterThanOrEqual(2);
  });

  it('POST /api/v1/__validate rechaza props no whitelisted', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/__validate')
      .send({ email: 'a@b.cl', name: 'Ana', extra: 'no permitido' })
      .expect(400);
    expect(res.body.statusCode).toBe(400);
    expect(JSON.stringify(res.body.message)).toMatch(/extra/);
  });
});
```

- [ ] **Step 3: Correr los E2E**

Run: `pnpm --filter api test:e2e`
Expected: 7 tests PASS. Pre-condición: la BD de desarrollo está levantada (Postgres en 5432).

Si el test de health falla por DB caída, levantar Docker:
```bash
docker compose -f docker/dev/docker-compose.yml up -d postgres
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/test
git commit -m "test(api): suite E2E del bootstrap (health, swagger, CORS, transform, filter, validation)"
```

---

### Task 15: Barrel exports y verificación final

**Files:**
- Create: `apps/api/src/common/index.ts`

- [ ] **Step 1: Crear el barrel `common/index.ts`**

```ts
// apps/api/src/common/index.ts
export * from './decorators/current-user.decorator';
export * from './decorators/roles.decorator';
export * from './filters/http-exception.filter';
export * from './guards/roles.guard';
export * from './interceptors/logging.interceptor';
export * from './interceptors/transform.interceptor';
export * from './types/request-user';
```

- [ ] **Step 2: Correr toda la suite (lint + format + tests + build + E2E)**

```bash
pnpm format:check
pnpm --filter api lint
pnpm --filter api test
pnpm --filter api test:cov
pnpm --filter api build
pnpm --filter api test:e2e
```

Expected: todo PASS. Cobertura ≥80% en `src/common/`.

Si `format:check` falla, ejecutar `pnpm format` y commitear los cambios de Prettier por separado:

```bash
pnpm format
git add -A
git commit -m "style: formatear archivos nuevos con Prettier"
```

- [ ] **Step 3: Verificación manual contra los criterios de aceptación del ticket**

Levantar la app y verificar a mano cada criterio del ticket:

```bash
pnpm --filter api dev
```

En otra terminal:

```bash
# Criterio 1: API levanta en 3001
curl -s http://localhost:3001/health | jq    # debe responder

# Criterio 2: Swagger en /api/docs
open http://localhost:3001/api/docs           # navegador: Swagger UI visible

# Criterio 3: Prisma conecta y modelos disponibles
# (verificado por el test de health: database.status = up)

# Criterio 4: Decoradores y guards exportados
grep -E "Roles|CurrentUser|RolesGuard" apps/api/src/common/index.ts
# debe listar las 3 entradas

# Criterio 5: dev --filter api funciona (ya verificado al levantar)
```

Detener el dev server con Ctrl-C.

- [ ] **Step 4: Commit del barrel**

```bash
git add apps/api/src/common/index.ts
git commit -m "feat(api): barrel exports en common/"
```

- [ ] **Step 5: Push de la rama**

```bash
git push -u origin feature/4-config-base-nestjs
```

---

## Criterios de aceptación finales (del spec)

Marcar al cerrar el plan:

- [ ] `pnpm dev --filter api` levanta la API en puerto 3001 sin errores
- [ ] `GET /health` responde 200 con DB conectada
- [ ] `GET /api/docs` muestra Swagger UI con bearer auth declarado
- [ ] Prisma conecta; `PrismaService` es inyectable en cualquier service
- [ ] Decoradores `@CurrentUser()`, `@Roles()` y `RolesGuard` exportados desde `common/`
- [ ] `pnpm --filter api test` pasa (≥6 unit specs)
- [ ] `pnpm --filter api test:e2e` pasa (≥7 E2E tests)
- [ ] CI en verde: Lint, Format, Type Check, Tests, Security Audit, Secrets Scan
- [ ] `.env.example` actualizado y commiteado
- [ ] Sin secretos en commits

## Pendiente fuera de esta PR

- ❌ JWT real / login → issue **#6** (B1-06)
- ❌ AuditInterceptor real → issue **#72** (B0-71)
- ❌ Migración throttler a Redis → cuando exista módulo de cache
- ❌ Health Redis/MinIO → cuando esos módulos existan
- ❌ Swagger detrás de auth en prod → decisión de despliegue
