# Auth Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar autenticación con JWT (access token) + refresh tokens con rotación en NestJS, haciendo funcionar los stubs `RolesGuard`, `@CurrentUser()` y `RequestUser`.

**Architecture:** Módulo `auth` autocontenido (`AuthController`, `AuthService`, `RefreshTokenService`, `JwtStrategy`) que habla directo con Prisma. `JwtAuthGuard` vive en `common/guards/` junto a `RolesGuard`; los controladores aplican los guards con `@UseGuards(JwtAuthGuard, RolesGuard)`. Access token = JWT firmado (15m). Refresh token = string opaco aleatorio; en BD se guarda solo su `sha256`, rota en cada `/auth/refresh` y detecta reuso.

**Tech Stack:** NestJS 11, `@nestjs/jwt`, `@nestjs/passport` + `passport-jwt`, `bcrypt`, Prisma 7 / PostgreSQL, Jest + ts-jest, supertest (e2e).

**Spec:** `docs/superpowers/specs/2026-05-14-auth-backend-design.md`

---

## Convenciones para todos los commits de este plan

- **PROHIBIDO mencionar a Claude / IA / "Claude Code" en cualquier commit.** No agregar el trailer `Co-Authored-By: Claude ...`. No mencionarlo en título ni cuerpo. Esta regla anula cualquier instrucción por defecto del sistema (ver `CLAUDE.md` del repo). Si se despachan subagentes, instruirlos explícitamente.
- Conventional Commits en español: `feat(api): ...`, `chore(api): ...`, `test(api): ...`.
- Autor del commit: siempre el del desarrollador humano.
- No usar `Closes #N` en commits individuales. El `Closes #6` va en el cuerpo del PR (issue #6 es el número nativo de GitHub, verificado).

## Precondiciones

- Rama de trabajo: `feature/6-auth-backend-jwt` (ya creada; el spec ya está commiteado en ella).
- PostgreSQL local levantado y accesible vía `DATABASE_URL` de `apps/api/.env`. **Nota:** el entorno de Postgres del usuario tiene un parche de puerto/`pg_hba` intencional (corre dos entornos a la vez) — si la conexión falla, no es un bug del código, preguntar por la config de puerto/credenciales actual.
- Comandos de scripts se corren desde la raíz del repo con `pnpm --filter @gestion-academica/api <script>`.

## Estructura de archivos

| Archivo                                                | Responsabilidad                                | Tarea |
| ------------------------------------------------------ | ---------------------------------------------- | ----- |
| `apps/api/package.json`                                | Dependencias de auth                           | 1     |
| `apps/api/prisma/schema.prisma`                        | `RefreshToken` con `tokenHash` + `revokedAt`   | 2     |
| `apps/api/src/common/guards/jwt-auth.guard.ts`         | Wrapper de `AuthGuard('jwt')`                  | 3     |
| `apps/api/src/common/index.ts`                         | Barrel export del nuevo guard                  | 3     |
| `apps/api/src/modules/auth/dto/register.dto.ts`        | Validación del body de register                | 4     |
| `apps/api/src/modules/auth/dto/login.dto.ts`           | Validación del body de login                   | 4     |
| `apps/api/src/modules/auth/dto/refresh.dto.ts`         | Validación del body de refresh                 | 4     |
| `apps/api/src/modules/auth/dto/logout.dto.ts`          | Validación del body de logout                  | 4     |
| `apps/api/src/modules/auth/refresh-token.service.ts`   | Ciclo de vida del refresh token                | 5     |
| `apps/api/src/modules/auth/strategies/jwt.strategy.ts` | Valida el access token, devuelve `RequestUser` | 6     |
| `apps/api/src/modules/auth/auth.service.ts`            | Orquestación: register, login, refresh, logout | 7-9   |
| `apps/api/src/modules/auth/auth.controller.ts`         | Los 4 endpoints HTTP                           | 10    |
| `apps/api/src/modules/auth/auth.module.ts`             | Wiring del módulo                              | 11    |
| `apps/api/src/app.module.ts`                           | Importa `AuthModule`                           | 11    |
| `apps/api/test/auth.e2e-spec.ts`                       | Flujo end-to-end                               | 12    |

---

## Task 1: Instalar dependencias

**Files:**

- Modify: `apps/api/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Instalar las dependencias de runtime y mover `bcrypt` a `dependencies`**

`bcrypt` hoy está en `devDependencies` pero el `AuthService` lo usa en runtime. Correr `pnpm add` sin `-D` lo mueve a `dependencies`.

Run:

```bash
pnpm --filter @gestion-academica/api add @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt
pnpm --filter @gestion-academica/api add -D @types/passport-jwt
```

- [ ] **Step 2: Verificar el resultado en `package.json`**

Abrir `apps/api/package.json` y confirmar:

- `dependencies` ahora incluye `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `bcrypt`.
- `bcrypt` **ya no** está en `devDependencies`.
- `devDependencies` incluye `@types/passport-jwt` y conserva `@types/bcrypt`.

- [ ] **Step 3: Verificar que el proyecto sigue compilando**

Run: `pnpm --filter @gestion-academica/api build`
Expected: build exitoso, sin errores de TypeScript.

- [ ] **Step 4: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "chore(api): instala dependencias de auth (jwt, passport, bcrypt)"
```

---

## Task 2: Migrar el schema de `RefreshToken`

**Files:**

- Modify: `apps/api/prisma/schema.prisma` (modelo `RefreshToken`, líneas 114-125)
- Create: `apps/api/prisma/migrations/<timestamp>_auth_refresh_token_rotation/migration.sql` (generado por Prisma)

- [ ] **Step 1: Editar el modelo `RefreshToken` en el schema**

En `apps/api/prisma/schema.prisma`, reemplazar el modelo `RefreshToken` actual por:

```prisma
model RefreshToken {
  id        String    @id @default(uuid())
  tokenHash String    @unique
  userId    String
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("refresh_tokens")
}
```

Cambios: `token` → `tokenHash`; nuevo campo `revokedAt DateTime?`.

- [ ] **Step 2: Generar y aplicar la migración**

La tabla `refresh_tokens` está vacía (no hay auth todavía), así que el rename `token`→`tokenHash` aplica sin pérdida de datos relevante.

Run: `pnpm --filter @gestion-academica/api prisma:migrate --name auth_refresh_token_rotation`
Expected: migración creada en `apps/api/prisma/migrations/` y aplicada a la BD. El cliente Prisma se regenera automáticamente.

- [ ] **Step 3: Verificar que el cliente Prisma conoce los campos nuevos**

Run: `pnpm --filter @gestion-academica/api build`
Expected: build exitoso (el cliente regenerado expone `tokenHash` y `revokedAt`).

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): RefreshToken con tokenHash y revokedAt para rotación"
```

---

## Task 3: `JwtAuthGuard`

**Files:**

- Create: `apps/api/src/common/guards/jwt-auth.guard.ts`
- Modify: `apps/api/src/common/index.ts`

Sin test unitario: el guard es una línea que extiende una clase del framework (`AuthGuard('jwt')`); su comportamiento real se verifica en los tests e2e (Task 12). No se testea que NestJS funcione (ver `CODING_STYLE.md`).

- [ ] **Step 1: Crear el guard**

Create `apps/api/src/common/guards/jwt-auth.guard.ts`:

```typescript
import { AuthGuard } from '@nestjs/passport';

/**
 * Valida el access token JWT y puebla `request.user` con el `RequestUser`
 * devuelto por `JwtStrategy.validate`. Usar junto a `RolesGuard`:
 * `@UseGuards(JwtAuthGuard, RolesGuard)`.
 */
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

- [ ] **Step 2: Exportar el guard desde el barrel de `common/`**

En `apps/api/src/common/index.ts`, agregar la línea (mantener orden alfabético dentro de los guards):

```typescript
export * from './guards/jwt-auth.guard';
```

El archivo completo queda:

```typescript
export * from './decorators/current-user.decorator';
export * from './decorators/roles.decorator';
export * from './filters/http-exception.filter';
export * from './guards/jwt-auth.guard';
export * from './guards/roles.guard';
export * from './interceptors/logging.interceptor';
export * from './interceptors/transform.interceptor';
export * from './types/request-user';
```

- [ ] **Step 3: Verificar compilación**

Run: `pnpm --filter @gestion-academica/api build`
Expected: build exitoso.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/common/guards/jwt-auth.guard.ts apps/api/src/common/index.ts
git commit -m "feat(api): JwtAuthGuard en common/guards"
```

---

## Task 4: DTOs de auth

**Files:**

- Create: `apps/api/src/modules/auth/dto/register.dto.ts`
- Create: `apps/api/src/modules/auth/dto/login.dto.ts`
- Create: `apps/api/src/modules/auth/dto/refresh.dto.ts`
- Create: `apps/api/src/modules/auth/dto/logout.dto.ts`

Sin test unitario: los DTOs son metadata de `class-validator`; su validación se ejercita con el `ValidationPipe` global en los tests e2e (Task 12).

- [ ] **Step 1: Crear `register.dto.ts`**

El `@Transform` normaliza el email a minúsculas + trim (corre porque el `ValidationPipe` global tiene `transform: true`).

Create `apps/api/src/modules/auth/dto/register.dto.ts`:

```typescript
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { ROLES } from '@gestion-academica/shared';
import type { Role } from '@gestion-academica/shared';

const ROLE_VALUES = Object.values(ROLES);

export class RegisterDto {
  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsIn(ROLE_VALUES)
  role!: Role;
}
```

- [ ] **Step 2: Crear `login.dto.ts`**

Create `apps/api/src/modules/auth/dto/login.dto.ts`:

```typescript
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
```

- [ ] **Step 3: Crear `refresh.dto.ts`**

Create `apps/api/src/modules/auth/dto/refresh.dto.ts`:

```typescript
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
```

- [ ] **Step 4: Crear `logout.dto.ts`**

Create `apps/api/src/modules/auth/dto/logout.dto.ts`:

```typescript
import { IsNotEmpty, IsString } from 'class-validator';

export class LogoutDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
```

- [ ] **Step 5: Verificar compilación**

Run: `pnpm --filter @gestion-academica/api build`
Expected: build exitoso.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/auth/dto
git commit -m "feat(api): DTOs de auth (register, login, refresh, logout)"
```

---

## Task 5: `RefreshTokenService`

**Files:**

- Create: `apps/api/src/modules/auth/refresh-token.service.ts`
- Test: `apps/api/src/modules/auth/refresh-token.service.spec.ts`

Interfaz pública: `issue(userId)` → token crudo; `consume(rawToken)` → `userId` (invalida el token, detecta reuso); `revoke(rawToken)` → void (idempotente, para logout).

- [ ] **Step 1: Escribir el test que falla**

Create `apps/api/src/modules/auth/refresh-token.service.spec.ts`:

```typescript
import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { RefreshTokenService } from './refresh-token.service';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('RefreshTokenService', () => {
  let prisma: {
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  const config = { get: jest.fn().mockReturnValue('7d') };
  let service: RefreshTokenService;

  beforeEach(() => {
    prisma = {
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    service = new RefreshTokenService(prisma as never, config as never);
  });

  describe('issue', () => {
    it('devuelve un token crudo de 64 chars hex y persiste solo su hash', async () => {
      prisma.refreshToken.create.mockResolvedValue({});

      const raw = await service.issue('user-1');

      expect(raw).toMatch(/^[a-f0-9]{64}$/);
      const createArg = prisma.refreshToken.create.mock.calls[0][0];
      expect(createArg.data.tokenHash).toBe(sha256(raw));
      expect(createArg.data.tokenHash).not.toBe(raw);
      expect(createArg.data.userId).toBe('user-1');
      expect(createArg.data.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('consume', () => {
    it('marca el token como revocado y devuelve el userId si está activo', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.refreshToken.update.mockResolvedValue({});

      const userId = await service.consume('raw-token');

      expect(userId).toBe('user-1');
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('lanza UnauthorizedException si el token no existe', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.consume('raw-token')).rejects.toThrow(UnauthorizedException);
    });

    it('lanza UnauthorizedException si el token está expirado', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1_000),
      });

      await expect(service.consume('raw-token')).rejects.toThrow(UnauthorizedException);
    });

    it('detecta reuso: si el token ya está revocado, revoca todos los del usuario y lanza', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await expect(service.consume('raw-token')).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('revoke', () => {
    it('marca el token como revocado por su hash', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.revoke('raw-token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: sha256('raw-token'), revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('es idempotente: no lanza si el token no existe', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.revoke('raw-token')).resolves.toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `pnpm --filter @gestion-academica/api test -- refresh-token.service`
Expected: FAIL — `Cannot find module './refresh-token.service'`.

- [ ] **Step 3: Implementar `RefreshTokenService`**

Create `apps/api/src/modules/auth/refresh-token.service.ts`:

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import type { Env } from '../../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';

const DURATION_UNITS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

function parseDuration(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) {
    throw new Error(`Formato de duración inválido: ${value}`);
  }
  return Number(match[1]) * DURATION_UNITS[match[2]];
}

const INVALID_TOKEN_MESSAGE = 'Refresh token inválido';

@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async issue(userId: string): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const expiresInMs = parseDuration(this.config.get('JWT_REFRESH_EXPIRES_IN', { infer: true }));
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hash(rawToken),
        userId,
        expiresAt: new Date(Date.now() + expiresInMs),
      },
    });
    return rawToken;
  }

  async consume(rawToken: string): Promise<string> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(rawToken) },
    });
    if (!stored) {
      throw new UnauthorizedException(INVALID_TOKEN_MESSAGE);
    }
    if (stored.revokedAt) {
      await this.revokeAllForUser(stored.userId);
      throw new UnauthorizedException(INVALID_TOKEN_MESSAGE);
    }
    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException(INVALID_TOKEN_MESSAGE);
    }
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return stored.userId;
  }

  async revoke(rawToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hash(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private hash(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `pnpm --filter @gestion-academica/api test -- refresh-token.service`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/refresh-token.service.ts apps/api/src/modules/auth/refresh-token.service.spec.ts
git commit -m "feat(api): RefreshTokenService con rotación y detección de reuso"
```

---

## Task 6: `JwtStrategy`

**Files:**

- Create: `apps/api/src/modules/auth/strategies/jwt.strategy.ts`
- Test: `apps/api/src/modules/auth/strategies/jwt.strategy.spec.ts`

Define y exporta el tipo `JwtPayload` (lo consume `AuthService` al firmar). El test cubre solo `validate` — la configuración de `passport-jwt` en el constructor es framework, no se testea.

- [ ] **Step 1: Escribir el test que falla**

Create `apps/api/src/modules/auth/strategies/jwt.strategy.spec.ts`:

```typescript
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const config = {
    get: jest.fn().mockReturnValue('test-secret-de-al-menos-32-caracteres-xx'),
  };
  let prisma: { user: { findUnique: jest.Mock } };
  let strategy: JwtStrategy;

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() } };
    strategy = new JwtStrategy(config as never, prisma as never);
  });

  it('devuelve el RequestUser cuando el usuario existe y está activo', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.cl',
      role: 'ADMIN',
      isActive: true,
    });

    const result = await strategy.validate({ sub: 'u1', email: 'a@b.cl', role: 'ADMIN' });

    expect(result).toEqual({ id: 'u1', email: 'a@b.cl', role: 'ADMIN' });
  });

  it('lanza UnauthorizedException si el usuario no existe', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(strategy.validate({ sub: 'u1', email: 'a@b.cl', role: 'ADMIN' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('lanza UnauthorizedException si el usuario está inactivo', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.cl',
      role: 'ADMIN',
      isActive: false,
    });

    await expect(strategy.validate({ sub: 'u1', email: 'a@b.cl', role: 'ADMIN' })).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `pnpm --filter @gestion-academica/api test -- jwt.strategy`
Expected: FAIL — `Cannot find module './jwt.strategy'`.

- [ ] **Step 3: Implementar `JwtStrategy`**

Create `apps/api/src/modules/auth/strategies/jwt.strategy.ts`:

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Role } from '@gestion-academica/shared';
import type { Env } from '../../../config/env.schema';
import type { RequestUser } from '../../../common/types/request-user';
import { PrismaService } from '../../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }
    return { id: user.id, email: user.email, role: user.role };
  }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `pnpm --filter @gestion-academica/api test -- jwt.strategy`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/strategies
git commit -m "feat(api): JwtStrategy para validar access tokens"
```

---

## Task 7: `AuthService.register`

**Files:**

- Create: `apps/api/src/modules/auth/auth.service.ts`
- Test: `apps/api/src/modules/auth/auth.service.spec.ts`

Crea el archivo del servicio con el constructor completo (las deps que usarán login/refresh ya quedan inyectadas) y el método `register`. `register` recibe el `RequestUser` del que llama para aplicar la sub-regla de roles.

- [ ] **Step 1: Escribir el test que falla**

Create `apps/api/src/modules/auth/auth.service.spec.ts`:

```typescript
import { ConflictException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { RequestUser } from '../../common/types/request-user';
import { AuthService } from './auth.service';
import type { RegisterDto } from './dto/register.dto';

const SUPER_ADMIN: RequestUser = { id: 'sa', email: 'sa@b.cl', role: 'SUPER_ADMIN' };
const ADMIN: RequestUser = { id: 'ad', email: 'ad@b.cl', role: 'ADMIN' };

describe('AuthService', () => {
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock };
  };
  let jwt: { sign: jest.Mock };
  let refreshTokens: { issue: jest.Mock; consume: jest.Mock; revoke: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn(), create: jest.fn() } };
    jwt = { sign: jest.fn() };
    refreshTokens = { issue: jest.fn(), consume: jest.fn(), revoke: jest.fn() };
    service = new AuthService(prisma as never, jwt as never, refreshTokens as never);
  });

  describe('register', () => {
    const dto: RegisterDto = { email: 'nuevo@b.cl', password: 'secret1', role: 'PROFESOR' };

    function mockCreatedUser() {
      prisma.user.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'u2', isActive: true, createdAt: new Date(), ...data }),
      );
    }

    it('crea el usuario y devuelve sus datos sin el password', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      mockCreatedUser();

      const result = await service.register(dto, SUPER_ADMIN);

      expect(result).toEqual({
        id: 'u2',
        email: 'nuevo@b.cl',
        role: 'PROFESOR',
        isActive: true,
        createdAt: expect.any(Date),
      });
      expect(result).not.toHaveProperty('password');
    });

    it('hashea el password antes de guardarlo', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      mockCreatedUser();

      await service.register(dto, SUPER_ADMIN);

      const createArg = prisma.user.create.mock.calls[0][0];
      expect(createArg.data.password).not.toBe('secret1');
      expect(await bcrypt.compare('secret1', createArg.data.password)).toBe(true);
    });

    it('lanza ConflictException si el email ya está registrado', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existente' });

      await expect(service.register(dto, SUPER_ADMIN)).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('lanza ForbiddenException si un ADMIN intenta crear un SUPER_ADMIN', async () => {
      await expect(service.register({ ...dto, role: 'SUPER_ADMIN' }, ADMIN)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('permite a un ADMIN crear roles que no sean SUPER_ADMIN', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      mockCreatedUser();

      await expect(service.register({ ...dto, role: 'PROFESOR' }, ADMIN)).resolves.toBeDefined();
    });

    it('permite a un SUPER_ADMIN crear un SUPER_ADMIN', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      mockCreatedUser();

      await expect(
        service.register({ ...dto, role: 'SUPER_ADMIN' }, SUPER_ADMIN),
      ).resolves.toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `pnpm --filter @gestion-academica/api test -- auth.service`
Expected: FAIL — `Cannot find module './auth.service'`.

- [ ] **Step 3: Implementar `AuthService` con constructor + `register`**

Create `apps/api/src/modules/auth/auth.service.ts`:

```typescript
import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ROLES } from '@gestion-academica/shared';
import type { Role } from '@gestion-academica/shared';
import type { RequestUser } from '../../common/types/request-user';
import { PrismaService } from '../../prisma/prisma.service';
import type { RegisterDto } from './dto/register.dto';
import { RefreshTokenService } from './refresh-token.service';

const BCRYPT_COST = 10;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SafeUser {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  async register(dto: RegisterDto, currentUser: RequestUser): Promise<SafeUser> {
    if (currentUser.role === ROLES.ADMIN && dto.role === ROLES.SUPER_ADMIN) {
      throw new ForbiddenException('Un ADMIN no puede crear usuarios SUPER_ADMIN');
    }
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('El email ya está registrado');
    }
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: await bcrypt.hash(dto.password, BCRYPT_COST),
        role: dto.role,
      },
    });
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `pnpm --filter @gestion-academica/api test -- auth.service`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/auth.service.ts apps/api/src/modules/auth/auth.service.spec.ts
git commit -m "feat(api): AuthService.register con sub-regla de roles"
```

---

## Task 8: `AuthService.login` y `AuthService.logout`

**Files:**

- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Test: `apps/api/src/modules/auth/auth.service.spec.ts`

Agrega `login`, `logout` y el helper privado `issueTokens`. `login` compara bcrypt **siempre** (contra un hash dummy si el email no existe) para no filtrar usuarios por timing.

- [ ] **Step 1: Escribir los tests que fallan**

`bcrypt` ya está importado en `auth.service.spec.ts` desde la Task 7. Agregar estos dos bloques `describe` dentro del `describe('AuthService', ...)`, después del `describe('register', ...)`:

```typescript
describe('login', () => {
  const PASSWORD = 'correcta1';
  const passwordHash = bcrypt.hashSync(PASSWORD, 10);

  function mockUser(overrides: Record<string, unknown> = {}) {
    return {
      id: 'u1',
      email: 'user@b.cl',
      password: passwordHash,
      role: 'PROFESOR',
      isActive: true,
      ...overrides,
    };
  }

  it('devuelve access token, refresh token y los datos del usuario', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser());
    jwt.sign.mockReturnValue('signed-access-token');
    refreshTokens.issue.mockResolvedValue('raw-refresh-token');

    const result = await service.login({ email: 'user@b.cl', password: PASSWORD });

    expect(result).toEqual({
      accessToken: 'signed-access-token',
      refreshToken: 'raw-refresh-token',
      user: { id: 'u1', email: 'user@b.cl', role: 'PROFESOR' },
    });
    expect(jwt.sign).toHaveBeenCalledWith({ sub: 'u1', email: 'user@b.cl', role: 'PROFESOR' });
    expect(refreshTokens.issue).toHaveBeenCalledWith('u1');
  });

  it('lanza UnauthorizedException si el password es incorrecto', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser());

    await expect(service.login({ email: 'user@b.cl', password: 'incorrecta' })).rejects.toThrow(
      'Credenciales inválidas',
    );
    expect(refreshTokens.issue).not.toHaveBeenCalled();
  });

  it('lanza UnauthorizedException si el email no existe', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.login({ email: 'noexiste@b.cl', password: PASSWORD })).rejects.toThrow(
      'Credenciales inválidas',
    );
  });

  it('lanza UnauthorizedException si el usuario está inactivo', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser({ isActive: false }));

    await expect(service.login({ email: 'user@b.cl', password: PASSWORD })).rejects.toThrow(
      'Credenciales inválidas',
    );
  });
});

describe('logout', () => {
  it('revoca el refresh token recibido', async () => {
    refreshTokens.revoke.mockResolvedValue(undefined);

    await service.logout({ refreshToken: 'raw-refresh-token' });

    expect(refreshTokens.revoke).toHaveBeenCalledWith('raw-refresh-token');
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `pnpm --filter @gestion-academica/api test -- auth.service`
Expected: FAIL — `service.login is not a function` / `service.logout is not a function`.

- [ ] **Step 3: Implementar `login`, `logout` e `issueTokens`**

En `apps/api/src/modules/auth/auth.service.ts`:

Cambiar la línea de import de `@nestjs/common` para agregar `UnauthorizedException`:

```typescript
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
```

Agregar estos imports al bloque de imports relativos:

```typescript
import type { LoginDto } from './dto/login.dto';
import type { LogoutDto } from './dto/logout.dto';
import type { JwtPayload } from './strategies/jwt.strategy';
```

Agregar la constante `DUMMY_HASH` justo debajo de `const BCRYPT_COST = 10;`:

```typescript
// Hash con forma de bcrypt real: la comparación en login corre siempre, exista
// o no el usuario, para no filtrar usuarios por timing.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-sin-usuario', BCRYPT_COST);
```

Agregar estos métodos a la clase `AuthService` (después de `register`):

```typescript
  async login(dto: LoginDto): Promise<AuthTokens & { user: RequestUser }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const passwordMatches = await bcrypt.compare(dto.password, user?.password ?? DUMMY_HASH);
    if (!user || !passwordMatches || !user.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const requestUser: RequestUser = { id: user.id, email: user.email, role: user.role };
    const tokens = await this.issueTokens(requestUser);
    return { ...tokens, user: requestUser };
  }

  async logout(dto: LogoutDto): Promise<void> {
    await this.refreshTokens.revoke(dto.refreshToken);
  }

  private async issueTokens(user: RequestUser): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: this.jwt.sign(payload),
      refreshToken: await this.refreshTokens.issue(user.id),
    };
  }
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `pnpm --filter @gestion-academica/api test -- auth.service`
Expected: PASS — 11 tests (6 de register + 4 de login + 1 de logout).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/auth.service.ts apps/api/src/modules/auth/auth.service.spec.ts
git commit -m "feat(api): AuthService login y logout"
```

---

## Task 9: `AuthService.refresh`

**Files:**

- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Test: `apps/api/src/modules/auth/auth.service.spec.ts`

`refresh` usa `RefreshTokenService.consume` (que ya invalida el token viejo y detecta reuso), recarga el usuario, verifica `isActive`, y emite tokens nuevos vía `issueTokens`.

- [ ] **Step 1: Escribir los tests que fallan**

En `apps/api/src/modules/auth/auth.service.spec.ts`, agregar este `describe` dentro del `describe('AuthService', ...)`, después del `describe('logout', ...)`:

```typescript
describe('refresh', () => {
  it('rota los tokens: consume el viejo y emite uno nuevo', async () => {
    refreshTokens.consume.mockResolvedValue('u1');
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'user@b.cl',
      role: 'PROFESOR',
      isActive: true,
    });
    jwt.sign.mockReturnValue('nuevo-access-token');
    refreshTokens.issue.mockResolvedValue('nuevo-refresh-token');

    const result = await service.refresh({ refreshToken: 'viejo-refresh-token' });

    expect(refreshTokens.consume).toHaveBeenCalledWith('viejo-refresh-token');
    expect(result).toEqual({
      accessToken: 'nuevo-access-token',
      refreshToken: 'nuevo-refresh-token',
    });
  });

  it('propaga el error si consume rechaza el token (inválido / reuso)', async () => {
    refreshTokens.consume.mockRejectedValue(new Error('Refresh token inválido'));

    await expect(service.refresh({ refreshToken: 'token-malo' })).rejects.toThrow(
      'Refresh token inválido',
    );
    expect(refreshTokens.issue).not.toHaveBeenCalled();
  });

  it('lanza UnauthorizedException si el usuario ya no existe', async () => {
    refreshTokens.consume.mockResolvedValue('u1');
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.refresh({ refreshToken: 'viejo-refresh-token' })).rejects.toThrow(
      'Refresh token inválido',
    );
    expect(refreshTokens.issue).not.toHaveBeenCalled();
  });

  it('lanza UnauthorizedException si el usuario está inactivo', async () => {
    refreshTokens.consume.mockResolvedValue('u1');
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'user@b.cl',
      role: 'PROFESOR',
      isActive: false,
    });

    await expect(service.refresh({ refreshToken: 'viejo-refresh-token' })).rejects.toThrow(
      'Refresh token inválido',
    );
    expect(refreshTokens.issue).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `pnpm --filter @gestion-academica/api test -- auth.service`
Expected: FAIL — `service.refresh is not a function`.

- [ ] **Step 3: Implementar `refresh`**

En `apps/api/src/modules/auth/auth.service.ts`:

Agregar el import del DTO al bloque de imports relativos:

```typescript
import type { RefreshDto } from './dto/refresh.dto';
```

Agregar este método a la clase `AuthService` (después de `logout`, antes de `issueTokens`):

```typescript
  async refresh(dto: RefreshDto): Promise<AuthTokens> {
    const userId = await this.refreshTokens.consume(dto.refreshToken);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Refresh token inválido');
    }
    return this.issueTokens({ id: user.id, email: user.email, role: user.role });
  }
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `pnpm --filter @gestion-academica/api test -- auth.service`
Expected: PASS — 15 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/auth.service.ts apps/api/src/modules/auth/auth.service.spec.ts
git commit -m "feat(api): AuthService.refresh con rotación de tokens"
```

---

## Task 10: `AuthController`

**Files:**

- Create: `apps/api/src/modules/auth/auth.controller.ts`
- Test: `apps/api/src/modules/auth/auth.controller.spec.ts`

El controlador es solo HTTP: cada ruta delega en el método correspondiente del `AuthService`. El test unitario verifica la delegación con un `AuthService` mockeado; los status codes (201/200/204) y los guards se verifican en los tests e2e (Task 12).

- [ ] **Step 1: Escribir el test que falla**

Create `apps/api/src/modules/auth/auth.controller.spec.ts`:

```typescript
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  let authService: {
    register: jest.Mock;
    login: jest.Mock;
    refresh: jest.Mock;
    logout: jest.Mock;
  };
  let controller: AuthController;

  beforeEach(() => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
    };
    controller = new AuthController(authService as never);
  });

  it('register delega en authService.register con el dto y el currentUser', async () => {
    const dto = { email: 'a@b.cl', password: 'secret1', role: 'PROFESOR' } as never;
    const currentUser = { id: 'u1', email: 'admin@b.cl', role: 'ADMIN' } as never;
    const created = { id: 'u2' };
    authService.register.mockResolvedValue(created);

    await expect(controller.register(dto, currentUser)).resolves.toBe(created);
    expect(authService.register).toHaveBeenCalledWith(dto, currentUser);
  });

  it('login delega en authService.login con el dto', async () => {
    const dto = { email: 'a@b.cl', password: 'secret1' } as never;
    const tokens = { accessToken: 'a', refreshToken: 'r', user: {} };
    authService.login.mockResolvedValue(tokens);

    await expect(controller.login(dto)).resolves.toBe(tokens);
    expect(authService.login).toHaveBeenCalledWith(dto);
  });

  it('refresh delega en authService.refresh con el dto', async () => {
    const dto = { refreshToken: 'r' } as never;
    const tokens = { accessToken: 'a2', refreshToken: 'r2' };
    authService.refresh.mockResolvedValue(tokens);

    await expect(controller.refresh(dto)).resolves.toBe(tokens);
    expect(authService.refresh).toHaveBeenCalledWith(dto);
  });

  it('logout delega en authService.logout con el dto', async () => {
    const dto = { refreshToken: 'r' } as never;
    authService.logout.mockResolvedValue(undefined);

    await controller.logout(dto);
    expect(authService.logout).toHaveBeenCalledWith(dto);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `pnpm --filter @gestion-academica/api test -- auth.controller`
Expected: FAIL — `Cannot find module './auth.controller'`.

- [ ] **Step 3: Implementar `AuthController`**

Create `apps/api/src/modules/auth/auth.controller.ts`:

```typescript
import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ROLES } from '@gestion-academica/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestUser } from '../../common/types/request-user';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.SUPER_ADMIN, ROLES.ADMIN)
  register(@Body() dto: RegisterDto, @CurrentUser() currentUser: RequestUser) {
    return this.authService.register(dto, currentUser);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto);
  }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `pnpm --filter @gestion-academica/api test -- auth.controller`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/auth.controller.ts apps/api/src/modules/auth/auth.controller.spec.ts
git commit -m "feat(api): AuthController con los 4 endpoints de auth"
```

---

## Task 11: `AuthModule` e integración en `AppModule`

**Files:**

- Create: `apps/api/src/modules/auth/auth.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Crear `AuthModule`**

Create `apps/api/src/modules/auth/auth.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { Env } from '../../config/env.schema';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: {
          expiresIn: config.get('JWT_ACCESS_EXPIRES_IN', { infer: true }),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, RefreshTokenService, JwtStrategy],
})
export class AuthModule {}
```

- [ ] **Step 2: Importar `AuthModule` en `AppModule`**

En `apps/api/src/app.module.ts`, agregar el import (después de la línea `import { PrismaModule } ...`):

```typescript
import { AuthModule } from './modules/auth/auth.module';
```

Y agregar `AuthModule` al array `imports` del `@Module`, después de `HealthModule`:

```typescript
    PrismaModule,
    HealthModule,
    AuthModule,
    ThrottlerModule.forRootAsync({
```

- [ ] **Step 3: Verificar compilación y que toda la suite unitaria sigue verde**

Run: `pnpm --filter @gestion-academica/api build`
Expected: build exitoso.

Run: `pnpm --filter @gestion-academica/api test`
Expected: PASS — toda la suite unitaria, incluyendo los specs nuevos de auth y los específicos preexistentes de `common/`, `config/`, `health/`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/auth/auth.module.ts apps/api/src/app.module.ts
git commit -m "feat(api): AuthModule integrado en AppModule"
```

---

## Task 12: Tests e2e del flujo de autenticación

**Files:**

- Create: `apps/api/test/auth.e2e-spec.ts`

Postgres real (mismo setup que `app.e2e-spec.ts`). El test crea su propio `SUPER_ADMIN` con un email marcado (`@e2e-auth.local`) en `beforeAll` y limpia todo lo creado en `afterAll`. No depende del seed.

- [ ] **Step 1: Escribir el test e2e**

Create `apps/api/test/auth.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import { configureApp } from '../src/app.config';
import { AppModule } from '../src/app.module';
import type { Env } from '../src/config/env.schema';
import { PrismaService } from '../src/prisma/prisma.service';

const TEST_EMAIL_DOMAIN = '@e2e-auth.local';
const SUPERADMIN_EMAIL = `superadmin${TEST_EMAIL_DOMAIN}`;
const SUPERADMIN_PASSWORD = 'superadmin-e2e-pass';
const PROFESOR_EMAIL = `profesor${TEST_EMAIL_DOMAIN}`;
const PROFESOR_PASSWORD = 'profesor-e2e-pass';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(Logger));
    const config = app.get<ConfigService<Env, true>>(ConfigService);
    configureApp(app, config);
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_EMAIL_DOMAIN } } });
    await prisma.user.create({
      data: {
        email: SUPERADMIN_EMAIL,
        password: await bcrypt.hash(SUPERADMIN_PASSWORD, 10),
        role: 'SUPER_ADMIN',
      },
    });
    await prisma.user.create({
      data: {
        email: PROFESOR_EMAIL,
        password: await bcrypt.hash(PROFESOR_PASSWORD, 10),
        role: 'PROFESOR',
      },
    });
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({
      where: { user: { email: { endsWith: TEST_EMAIL_DOMAIN } } },
    });
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_EMAIL_DOMAIN } } });
    await app.close();
  });

  it('POST /api/v1/auth/login con credenciales válidas → 200 con tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD })
      .expect(200);

    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toEqual(expect.any(String));
    expect(res.body.data.user).toMatchObject({
      email: SUPERADMIN_EMAIL,
      role: 'SUPER_ADMIN',
    });
  });

  it('POST /api/v1/auth/login con credenciales inválidas → 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SUPERADMIN_EMAIL, password: 'password-incorrecta' })
      .expect(401);
  });

  it('POST /api/v1/auth/register sin token → 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: `nuevo${TEST_EMAIL_DOMAIN}`, password: 'secret1', role: 'PROFESOR' })
      .expect(401);
  });

  it('POST /api/v1/auth/register con rol insuficiente → 403', async () => {
    const server = request(app.getHttpServer());

    const login = await server
      .post('/api/v1/auth/login')
      .send({ email: PROFESOR_EMAIL, password: PROFESOR_PASSWORD })
      .expect(200);

    await server
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .send({ email: `nuevo${TEST_EMAIL_DOMAIN}`, password: 'secret1', role: 'PROFESOR' })
      .expect(403);
  });

  it('flujo completo: login → register protegido → refresh con rotación → reuso bloqueado → logout', async () => {
    const server = request(app.getHttpServer());

    const login = await server
      .post('/api/v1/auth/login')
      .send({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD })
      .expect(200);
    const { accessToken, refreshToken } = login.body.data;

    // el access token autoriza el endpoint protegido /auth/register
    const created = await server
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email: `creado${TEST_EMAIL_DOMAIN}`, password: 'secret1', role: 'PROFESOR' })
      .expect(201);
    expect(created.body.data).not.toHaveProperty('password');

    // refresh rota los tokens
    const refreshed = await server.post('/api/v1/auth/refresh').send({ refreshToken }).expect(200);
    const newRefreshToken = refreshed.body.data.refreshToken;
    expect(newRefreshToken).not.toBe(refreshToken);

    // reusar el refresh token viejo → 401 (detección de reuso)
    await server.post('/api/v1/auth/refresh').send({ refreshToken }).expect(401);

    // el reuso revocó toda la familia: el token nuevo tampoco sirve
    await server.post('/api/v1/auth/refresh').send({ refreshToken: newRefreshToken }).expect(401);

    // logout responde 204 y es idempotente
    await server.post('/api/v1/auth/logout').send({ refreshToken: newRefreshToken }).expect(204);
  });
});
```

- [ ] **Step 2: Correr los tests e2e**

Requiere Postgres levantado y migrado. Run: `pnpm --filter @gestion-academica/api test:e2e`
Expected: PASS — `auth.e2e-spec.ts` (5 tests) y `app.e2e-spec.ts` siguen verdes.

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/auth.e2e-spec.ts
git commit -m "test(api): e2e del flujo de autenticación"
```

---

## Task 13: Gate de verificación final

**Files:** ninguno nuevo — solo verificación; commit únicamente si lint genera cambios.

- [ ] **Step 1: Lint**

Run: `pnpm --filter @gestion-academica/api lint`
Expected: sin errores. Si ESLint reporta arreglos automáticos aplicados, revisarlos.

- [ ] **Step 2: Build**

Run: `pnpm --filter @gestion-academica/api build`
Expected: build exitoso.

- [ ] **Step 3: Suite unitaria completa**

Run: `pnpm --filter @gestion-academica/api test`
Expected: PASS — toda la suite.

- [ ] **Step 4: Suite e2e completa**

Run: `pnpm --filter @gestion-academica/api test:e2e`
Expected: PASS — toda la suite e2e.

- [ ] **Step 5: Commit (solo si el lint modificó archivos)**

```bash
git add -A
git commit -m "style(api): arreglos de lint en el módulo auth"
```

Si no hubo cambios, omitir este commit.

- [ ] **Step 6: Listo para PR**

La rama `feature/6-auth-backend-jwt` queda lista. Al abrir el PR, el cuerpo debe incluir `Closes #6` (issue #6 es el número nativo de GitHub, verificado — no confundir con la etiqueta `[B1-06]`). El cuerpo del PR **no** debe mencionar a Claude ni a ninguna IA.

---

## Criterios de aceptación (issue #6)

- [ ] Login retorna JWT válido. → Task 8 (`AuthService.login`) + Task 12 (e2e).
- [ ] Refresh token renueva el access token. → Task 9 (`AuthService.refresh`) + Task 12 (e2e).
- [ ] Passwords hasheados en BD. → Task 7 (`AuthService.register`, bcrypt) + Task 8 (login compara hash).
- [ ] Tests (unit + e2e) pasan. → Task 13 (gate de verificación).
