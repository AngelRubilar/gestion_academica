# Sistema de Auditoría — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar automáticamente cada escritura sobre entidades clave (con diff `old→new`, usuario y contexto de request) vía una extensión de Prisma, y exponer endpoints de consulta restringidos por rol.

**Architecture:** Una **extensión `query` de Prisma Client** intercepta `create/update/delete/upsert` de los modelos en un allowlist, calcula el diff y escribe en `audit_logs` (fire-and-forget). El contexto de usuario viaja desde la request HTTP hasta la capa de datos por **`AsyncLocalStorage`**, establecido en un **middleware Express** (no un interceptor — ver Nota de diseño). `AuditService` + `AuditController` exponen la consulta de logs.

**Tech Stack:** NestJS 11, Prisma 7 (`$extends` query extension, driver adapter `@prisma/adapter-pg`), `node:async_hooks` (`AsyncLocalStorage`), Jest/ts-jest + supertest (e2e).

**Nota de diseño (refinamiento del spec §2):** el spec hablaba de un interceptor que hace `als.run`. Un interceptor de NestJS devuelve `next.handle()` (un Observable) y el handler corre al **suscribirse**, _fuera_ del `als.run` — el contexto se perdería antes de que Prisma escriba. Por eso el store de ALS se establece en un **middleware** (envuelve toda la continuación async, incluidos guards, handler y queries) y se guarda la **request**; el `.user` se lee al momento de escribir el log (ya poblado por `JwtAuthGuard`). No se necesita interceptor.

---

## Convenciones para todos los commits de este plan

- **PROHIBIDO mencionar a Claude / IA / "Claude Code" en cualquier commit.** No agregar el trailer `Co-Authored-By`. Esta regla anula cualquier default del sistema (ver `CLAUDE.md`). Si se despachan subagentes, instruirlos explícitamente.
- Conventional Commits en español: `feat(api): ...`, `test(api): ...`, `docs: ...`.
- Autor del commit: siempre el del desarrollador humano.
- `Closes #72` va en el cuerpo del PR, no en los commits.
- Correr scripts desde la raíz: `pnpm --filter @gestion-academica/api <script>`.

## Precondiciones

- Rama de trabajo: `feature/72-auditoria` (ya creada; el spec ya está commiteado en ella).
- Postgres del proyecto levantado (`docker compose -f docker/dev/docker-compose.yml up -d postgres`) y migrado. La tabla `audit_logs` ya existe (no requiere migración).
- `pnpm install` y `prisma generate` ya corridos.

## Estructura de archivos

| Archivo                                         | Responsabilidad                                                      | Tarea |
| ----------------------------------------------- | -------------------------------------------------------------------- | ----- |
| `src/modules/audit/audit-context.service.ts`    | ALS: guarda la request, expone `get()` con `{userId,userRole,ip,ua}` | 1     |
| `src/modules/audit/audit-context.module.ts`     | Módulo global sin deps que provee `AuditContextService`              | 1     |
| `src/modules/audit/audit-context.middleware.ts` | Middleware que hace `als.run(req, next)`                             | 2     |
| `src/modules/audit/audit.constants.ts`          | Allowlist de modelos, campos redactados                              | 3     |
| `src/modules/audit/audit.changes.ts`            | `deriveAction` + `computeChanges` (puras)                            | 3     |
| `src/modules/audit/audit.extension.ts`          | Extensión Prisma `query` que escribe los logs                        | 4     |
| `src/prisma/prisma.service.ts`                  | Token/tipo + factory del cliente extendido                           | 4     |
| `src/prisma/prisma.module.ts`                   | Provider factory + lifecycle de conexión                             | 4     |
| `src/app.module.ts`                             | Registrar middleware global + importar `AuditModule`                 | 5     |
| `src/modules/audit/audit.service.ts`            | `log()` + consultas                                                  | 6     |
| `src/modules/audit/dto/audit-query.dto.ts`      | Validación de filtros de `GET /audit-logs`                           | 7     |
| `src/modules/audit/audit.controller.ts`         | Endpoints de consulta protegidos por rol                             | 7     |
| `src/modules/audit/audit.module.ts`             | Wiring del módulo de auditoría                                       | 7     |
| `test/auth.e2e-spec.ts`                         | Limpiar `audit_logs` antes de borrar usuarios (FK)                   | 8     |
| `test/audit.e2e-spec.ts`                        | E2E: register audita; consulta por rol                               | 8     |

---

## Task 1: `AuditContextService` (AsyncLocalStorage)

**Files:**

- Create: `apps/api/src/modules/audit/audit-context.service.ts`
- Create: `apps/api/src/modules/audit/audit-context.module.ts`
- Test: `apps/api/src/modules/audit/audit-context.service.spec.ts`

Guarda la request Express en el ALS y expone un getter tipado. Si no hay request o no hay `user`, devuelve `undefined` (→ la escritura no se audita).

- [ ] **Step 1: Escribir el test que falla**

Create `apps/api/src/modules/audit/audit-context.service.spec.ts`:

```typescript
import { AuditContextService } from './audit-context.service';

function fakeReq(over: Record<string, unknown> = {}) {
  return {
    user: { id: 'u1', email: 'a@b.cl', role: 'ADMIN' },
    ip: '10.0.0.1',
    headers: { 'user-agent': 'jest' },
    ...over,
  } as never;
}

describe('AuditContextService', () => {
  let service: AuditContextService;

  beforeEach(() => {
    service = new AuditContextService();
  });

  it('fuera de run() no hay contexto', () => {
    expect(service.get()).toBeUndefined();
  });

  it('dentro de run() expone userId, userRole, ip y user-agent', () => {
    service.run(fakeReq(), () => {
      expect(service.get()).toEqual({
        userId: 'u1',
        userRole: 'ADMIN',
        ipAddress: '10.0.0.1',
        userAgent: 'jest',
      });
    });
  });

  it('si la request no tiene user, get() devuelve undefined (no se audita)', () => {
    service.run(fakeReq({ user: undefined }), () => {
      expect(service.get()).toBeUndefined();
    });
  });

  it('propaga el contexto a través de awaits', async () => {
    await service.run(fakeReq(), async () => {
      await Promise.resolve();
      expect(service.get()?.userId).toBe('u1');
    });
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `pnpm --filter @gestion-academica/api test -- audit-context.service`
Expected: FAIL — `Cannot find module './audit-context.service'`.

- [ ] **Step 3: Implementar `AuditContextService`**

Create `apps/api/src/modules/audit/audit-context.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Role } from '@gestion-academica/shared';
import type { RequestUser } from '../../common/types/request-user';

interface AuditRequest {
  user?: RequestUser;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

export interface AuditContext {
  userId: string;
  userRole: Role;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditContextService {
  private readonly als = new AsyncLocalStorage<AuditRequest>();

  run<T>(req: AuditRequest, fn: () => T): T {
    return this.als.run(req, fn);
  }

  get(): AuditContext | undefined {
    const req = this.als.getStore();
    const user = req?.user;
    if (!req || !user) {
      return undefined;
    }
    const ua = req.headers['user-agent'];
    return {
      userId: user.id,
      userRole: user.role,
      ipAddress: req.ip,
      userAgent: Array.isArray(ua) ? ua[0] : ua,
    };
  }
}
```

- [ ] **Step 4: Crear el módulo global**

Create `apps/api/src/modules/audit/audit-context.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { AuditContextService } from './audit-context.service';

// Módulo propio sin dependencias: lo consumen tanto PrismaModule (para la
// extensión) como AuditModule, sin crear un ciclo entre ellos.
@Global()
@Module({
  providers: [AuditContextService],
  exports: [AuditContextService],
})
export class AuditContextModule {}
```

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `pnpm --filter @gestion-academica/api test -- audit-context.service`
Expected: PASS — 4 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/audit/audit-context.service.ts apps/api/src/modules/audit/audit-context.service.spec.ts apps/api/src/modules/audit/audit-context.module.ts
git commit -m "feat(api): AuditContextService con AsyncLocalStorage para contexto de auditoría"
```

---

## Task 2: `AuditContextMiddleware`

**Files:**

- Create: `apps/api/src/modules/audit/audit-context.middleware.ts`

Sin test unitario: es una línea que delega en `AuditContextService.run`; su efecto se verifica en los e2e (Task 8). No se testea que NestJS/Express ejecuten el `next`.

- [ ] **Step 1: Implementar el middleware**

Create `apps/api/src/modules/audit/audit-context.middleware.ts`:

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { AuditContextService } from './audit-context.service';

/**
 * Establece el store de ALS para toda la vida de la request. Corre ANTES de los
 * guards, así que `req.user` aún no existe acá; se guarda la request y el `.user`
 * se lee al momento de escribir el log (ya poblado por JwtAuthGuard).
 */
@Injectable()
export class AuditContextMiddleware implements NestMiddleware {
  constructor(private readonly auditContext: AuditContextService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    this.auditContext.run(req, () => next());
  }
}
```

- [ ] **Step 2: Verificar compilación**

Run: `pnpm --filter @gestion-academica/api build`
Expected: build exitoso.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/audit/audit-context.middleware.ts
git commit -m "feat(api): AuditContextMiddleware que establece el store de ALS por request"
```

---

## Task 3: Lógica pura — `audit.constants.ts` y `audit.changes.ts`

**Files:**

- Create: `apps/api/src/modules/audit/audit.constants.ts`
- Create: `apps/api/src/modules/audit/audit.changes.ts`
- Test: `apps/api/src/modules/audit/audit.changes.spec.ts`

El núcleo de la lógica, en funciones puras y testeables sin Prisma: derivar la acción y calcular el diff redactado.

- [ ] **Step 1: Crear las constantes**

Create `apps/api/src/modules/audit/audit.constants.ts`:

```typescript
// Modelos de dominio cuyas escrituras se auditan. Cada issue de CRUD agrega el
// suyo. RefreshToken/AuditLog quedan fuera por definición (plumbing / recursión).
export const AUDITED_MODELS = new Set<string>(['User']);

// Campos que nunca deben quedar en texto plano en un snapshot/diff.
export const REDACTED_FIELDS = new Set<string>(['password', 'tokenHash']);

export const REDACTED_VALUE = '[REDACTED]';
```

- [ ] **Step 2: Escribir el test que falla**

Create `apps/api/src/modules/audit/audit.changes.spec.ts`:

```typescript
import { AUDIT_ACTIONS } from '@gestion-academica/shared';
import { deriveAction, computeChanges } from './audit.changes';

describe('deriveAction', () => {
  it('create → CREATE', () => {
    expect(deriveAction('create', undefined, { id: '1' })).toBe(AUDIT_ACTIONS.CREATE);
  });

  it('delete → DELETE', () => {
    expect(deriveAction('delete', { id: '1' }, { id: '1' })).toBe(AUDIT_ACTIONS.DELETE);
  });

  it('update normal → UPDATE', () => {
    expect(deriveAction('update', { id: '1', email: 'a' }, { id: '1', email: 'b' })).toBe(
      AUDIT_ACTIONS.UPDATE,
    );
  });

  it('update con isActive true→false → DEACTIVATE', () => {
    expect(deriveAction('update', { id: '1', isActive: true }, { id: '1', isActive: false })).toBe(
      AUDIT_ACTIONS.DEACTIVATE,
    );
  });

  it('update con isActive false→true → REACTIVATE', () => {
    expect(deriveAction('update', { id: '1', isActive: false }, { id: '1', isActive: true })).toBe(
      AUDIT_ACTIONS.REACTIVATE,
    );
  });

  it('upsert sin pre-image (insertó) → CREATE', () => {
    expect(deriveAction('upsert', undefined, { id: '1' })).toBe(AUDIT_ACTIONS.CREATE);
  });
});

describe('computeChanges', () => {
  it('CREATE incluye el snapshot nuevo con password redactado', () => {
    const changes = computeChanges(AUDIT_ACTIONS.CREATE, undefined, {
      id: '1',
      email: 'a@b.cl',
      password: 'hash-secreto',
    });
    expect(changes).toEqual({
      new: { id: '1', email: 'a@b.cl', password: '[REDACTED]' },
    });
  });

  it('DELETE incluye el snapshot viejo redactado', () => {
    const changes = computeChanges(
      AUDIT_ACTIONS.DELETE,
      { id: '1', email: 'a@b.cl', password: 'h' },
      { id: '1' },
    );
    expect(changes).toEqual({ old: { id: '1', email: 'a@b.cl', password: '[REDACTED]' } });
  });

  it('UPDATE incluye solo los campos cambiados como {old,new}', () => {
    const changes = computeChanges(
      AUDIT_ACTIONS.UPDATE,
      { id: '1', email: 'a@b.cl', role: 'PROFESOR' },
      { id: '1', email: 'nuevo@b.cl', role: 'PROFESOR' },
    );
    expect(changes).toEqual({ email: { old: 'a@b.cl', new: 'nuevo@b.cl' } });
  });

  it('UPDATE redacta old y new de un campo sensible', () => {
    const changes = computeChanges(
      AUDIT_ACTIONS.UPDATE,
      { id: '1', password: 'viejo' },
      { id: '1', password: 'nuevo' },
    );
    expect(changes).toEqual({ password: { old: '[REDACTED]', new: '[REDACTED]' } });
  });

  it('compara fechas por valor, no por referencia', () => {
    const changes = computeChanges(
      AUDIT_ACTIONS.UPDATE,
      { id: '1', updatedAt: new Date('2026-01-01') },
      { id: '1', updatedAt: new Date('2026-01-01') },
    );
    expect(changes).toEqual({});
  });
});
```

- [ ] **Step 3: Correr el test para verificar que falla**

Run: `pnpm --filter @gestion-academica/api test -- audit.changes`
Expected: FAIL — `Cannot find module './audit.changes'`.

- [ ] **Step 4: Implementar `audit.changes.ts`**

Create `apps/api/src/modules/audit/audit.changes.ts`:

```typescript
import { AUDIT_ACTIONS } from '@gestion-academica/shared';
import type { AuditAction } from '@gestion-academica/shared';
import { REDACTED_FIELDS, REDACTED_VALUE } from './audit.constants';

export type WriteOperation = 'create' | 'update' | 'delete' | 'upsert';
type Row = Record<string, unknown>;

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (a === b) return true;
  // Comparación estructural de respaldo para objetos/arrays anidados.
  return JSON.stringify(a) === JSON.stringify(b);
}

function redactSnapshot(row: Row): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = REDACTED_FIELDS.has(key) ? REDACTED_VALUE : value;
  }
  return out;
}

function redactField(key: string, value: unknown): unknown {
  return REDACTED_FIELDS.has(key) ? REDACTED_VALUE : value;
}

export function deriveAction(
  operation: WriteOperation,
  pre: Row | undefined,
  post: Row | undefined,
): AuditAction {
  if (operation === 'create') return AUDIT_ACTIONS.CREATE;
  if (operation === 'delete') return AUDIT_ACTIONS.DELETE;
  // update | upsert
  if (!pre) return AUDIT_ACTIONS.CREATE; // upsert que insertó
  if (pre.isActive === true && post?.isActive === false) return AUDIT_ACTIONS.DEACTIVATE;
  if (pre.isActive === false && post?.isActive === true) return AUDIT_ACTIONS.REACTIVATE;
  return AUDIT_ACTIONS.UPDATE;
}

export function computeChanges(
  action: AuditAction,
  pre: Row | undefined,
  post: Row | undefined,
): Record<string, unknown> {
  if (action === AUDIT_ACTIONS.CREATE) {
    return { new: redactSnapshot(post ?? {}) };
  }
  if (action === AUDIT_ACTIONS.DELETE) {
    return { old: redactSnapshot(pre ?? {}) };
  }
  // UPDATE | DEACTIVATE | REACTIVATE → diff campo a campo
  const diff: Record<string, { old: unknown; new: unknown }> = {};
  const keys = new Set([...Object.keys(pre ?? {}), ...Object.keys(post ?? {})]);
  for (const key of keys) {
    const oldValue = pre?.[key];
    const newValue = post?.[key];
    if (!valuesEqual(oldValue, newValue)) {
      diff[key] = { old: redactField(key, oldValue), new: redactField(key, newValue) };
    }
  }
  return diff;
}
```

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `pnpm --filter @gestion-academica/api test -- audit.changes`
Expected: PASS — 12 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/audit/audit.constants.ts apps/api/src/modules/audit/audit.changes.ts apps/api/src/modules/audit/audit.changes.spec.ts
git commit -m "feat(api): lógica pura de auditoría (deriveAction + computeChanges con redacción)"
```

---

## Task 4: Extensión de Prisma y wiring en `PrismaService`

**Files:**

- Create: `apps/api/src/modules/audit/audit.extension.ts`
- Modify: `apps/api/src/prisma/prisma.service.ts`
- Modify: `apps/api/src/prisma/prisma.module.ts`

La extensión intercepta las escrituras de modelos auditados, calcula el diff y escribe el log fire-and-forget. `PrismaService` pasa a ser un **token/tipo** cuya instancia real es el cliente extendido (creado por un factory); así todos los call sites existentes (`this.prisma.user...`) siguen funcionando sin cambios.

Sin test unitario directo de la extensión (requiere un cliente Prisma real e intercepción interna); se cubre end-to-end en Task 8. La lógica testeable ya vive en `audit.changes` (Task 3).

- [ ] **Step 1: Implementar la extensión**

Create `apps/api/src/modules/audit/audit.extension.ts`:

```typescript
import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuditContextService } from './audit-context.service';
import { AUDITED_MODELS } from './audit.constants';
import { computeChanges, deriveAction } from './audit.changes';
import type { WriteOperation } from './audit.changes';

type Row = Record<string, unknown>;

/**
 * Extensión `query` que audita create/update/delete/upsert de los modelos del
 * allowlist. El log se escribe fire-and-forget para no bloquear la request.
 */
export function auditExtension(auditContext: AuditContextService) {
  const logger = new Logger('AuditExtension');

  return Prisma.defineExtension((client) =>
    client.$extends({
      name: 'audit',
      query: {
        $allModels: {
          async create({ model, args, query }) {
            const result = (await query(args)) as Row;
            writeLog(model, 'create', undefined, result);
            return result;
          },
          async update({ model, args, query }) {
            const pre = await readPre(model, (args as { where: unknown }).where);
            const result = (await query(args)) as Row;
            writeLog(model, 'update', pre, result);
            return result;
          },
          async upsert({ model, args, query }) {
            const pre = await readPre(model, (args as { where: unknown }).where);
            const result = (await query(args)) as Row;
            writeLog(model, 'upsert', pre, result);
            return result;
          },
          async delete({ model, args, query }) {
            const pre = await readPre(model, (args as { where: unknown }).where);
            const result = (await query(args)) as Row;
            writeLog(model, 'delete', pre, result);
            return result;
          },
        },
      },
    }),
  );

  function delegate(model: string): { findUnique: (a: unknown) => Promise<Row | null> } {
    const key = model.charAt(0).toLowerCase() + model.slice(1);
    return (
      client as unknown as Record<string, { findUnique: (a: unknown) => Promise<Row | null> }>
    )[key];
  }

  async function readPre(model: string, where: unknown): Promise<Row | undefined> {
    if (!AUDITED_MODELS.has(model)) return undefined;
    const found = await delegate(model).findUnique({ where });
    return found ?? undefined;
  }

  function writeLog(
    model: string,
    operation: WriteOperation,
    pre: Row | undefined,
    post: Row | undefined,
  ): void {
    if (!AUDITED_MODELS.has(model)) return;
    const ctx = auditContext.get();
    if (!ctx) {
      logger.debug(`Escritura en ${model} sin contexto de usuario; no se audita`);
      return;
    }
    const action = deriveAction(operation, pre, post);
    const entityId = String((post ?? pre)?.id ?? '');
    const changes = computeChanges(action, pre, post);

    // Fire-and-forget: no se await para no bloquear la request. AuditLog no está
    // en AUDITED_MODELS, así que este create no recursiona.
    void (
      client as unknown as {
        auditLog: { create: (a: unknown) => Promise<unknown> };
      }
    ).auditLog
      .create({
        data: {
          entityType: model,
          entityId,
          action,
          changes: changes as Prisma.InputJsonValue,
          userId: ctx.userId,
          userRole: ctx.userRole,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
      })
      .catch((err: unknown) => logger.error(`No se pudo escribir el audit log de ${model}`, err));
  }
}
```

- [ ] **Step 2: Reescribir `PrismaService` como token + factory**

Replace `apps/api/src/prisma/prisma.service.ts` con:

```typescript
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import { auditExtension } from '../modules/audit/audit.extension';
import { AuditContextService } from '../modules/audit/audit-context.service';

/**
 * Crea el PrismaClient con el adapter pg y la extensión de auditoría aplicada.
 * El cliente extendido conserva los mismos delegates (`.user`, `.auditLog`, …),
 * por eso los call sites que inyectan `PrismaService` no cambian.
 */
export function createPrismaClient(
  config: ConfigService<Env, true>,
  auditContext: AuditContextService,
) {
  const base = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: config.get('DATABASE_URL', { infer: true }),
    }),
    log: config.get('NODE_ENV', { infer: true }) === 'development' ? ['warn', 'error'] : ['error'],
  });
  return base.$extends(auditExtension(auditContext));
}

// Token de inyección + tipo. La instancia real es el cliente extendido (la crea
// el factory de PrismaModule). No instanciar esta clase directamente.
export class PrismaService extends PrismaClient {}
```

- [ ] **Step 3: Reescribir `PrismaModule` con factory + lifecycle**

Replace `apps/api/src/prisma/prisma.module.ts` con:

```typescript
import { Global, Inject, Injectable, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditContextModule } from '../modules/audit/audit-context.module';
import { AuditContextService } from '../modules/audit/audit-context.service';
import { createPrismaClient, PrismaService } from './prisma.service';

// El cliente extendido no es una instancia de la clase PrismaService, así que
// los hooks de ciclo de vida se manejan en este provider dedicado.
@Injectable()
class PrismaLifecycle implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.prisma.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

@Global()
@Module({
  imports: [AuditContextModule],
  providers: [
    {
      provide: PrismaService,
      inject: [ConfigService, AuditContextService],
      useFactory: (config: ConfigService, auditContext: AuditContextService) =>
        createPrismaClient(config, auditContext),
    },
    PrismaLifecycle,
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 4: Verificar compilación y que la suite unitaria sigue verde**

Run: `pnpm --filter @gestion-academica/api build`
Expected: build exitoso.

Run: `pnpm --filter @gestion-academica/api test`
Expected: PASS — toda la suite unitaria (los specs que mockean `PrismaService` siguen pasando; no instancian el cliente real).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/audit/audit.extension.ts apps/api/src/prisma/prisma.service.ts apps/api/src/prisma/prisma.module.ts
git commit -m "feat(api): extensión Prisma de auditoría y wiring del cliente extendido"
```

---

## Task 5: Registrar el middleware global e importar el módulo

**Files:**

- Modify: `apps/api/src/app.module.ts`

`AuditModule` se crea en Task 7; acá solo se registra el middleware (que ya existe) para que el contexto esté disponible cuanto antes. El import de `AuditModule` se agrega en Task 7.

- [ ] **Step 1: Hacer que `AppModule` implemente `NestModule` y registre el middleware**

En `apps/api/src/app.module.ts`:

Cambiar la firma del import de `@nestjs/common` para incluir `MiddlewareConsumer` y `NestModule`:

```typescript
import { MiddlewareConsumer, Module, NestModule, ValidationPipe } from '@nestjs/common';
```

Agregar el import del middleware (junto a los demás imports relativos):

```typescript
import { AuditContextMiddleware } from './modules/audit/audit-context.middleware';
```

Cambiar la declaración de la clase para implementar `NestModule` y aplicar el middleware a todas las rutas:

```typescript
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuditContextMiddleware).forRoutes('*');
  }
}
```

- [ ] **Step 2: Verificar compilación**

Run: `pnpm --filter @gestion-academica/api build`
Expected: build exitoso.

> Nota: `AuditContextMiddleware` depende de `AuditContextService`, provisto por `AuditContextModule` (`@Global`, importado por `PrismaModule` en Task 4), así que ya está disponible para inyección en el middleware.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/app.module.ts
git commit -m "feat(api): registrar AuditContextMiddleware global"
```

---

## Task 6: `AuditService`

**Files:**

- Create: `apps/api/src/modules/audit/audit.service.ts`
- Test: `apps/api/src/modules/audit/audit.service.spec.ts`

API de escritura manual (`log`) y de consulta (`findMany`, `findByEntity`, `findByUser`). Las consultas arman el `where` de Prisma a partir de filtros opcionales.

- [ ] **Step 1: Escribir el test que falla**

Create `apps/api/src/modules/audit/audit.service.spec.ts`:

```typescript
import { AUDIT_ACTIONS } from '@gestion-academica/shared';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let prisma: { auditLog: { create: jest.Mock; findMany: jest.Mock; count: jest.Mock } };
  let service: AuditService;

  beforeEach(() => {
    prisma = {
      auditLog: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    };
    service = new AuditService(prisma as never);
  });

  describe('log', () => {
    it('inserta una fila con los datos provistos', async () => {
      prisma.auditLog.create.mockResolvedValue({ id: 'a1' });
      await service.log({
        entityType: 'User',
        entityId: 'u1',
        action: AUDIT_ACTIONS.CREATE,
        changes: { new: { id: 'u1' } },
        context: { userId: 'admin', userRole: 'ADMIN', ipAddress: '1.1.1.1', userAgent: 'jest' },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          entityType: 'User',
          entityId: 'u1',
          action: AUDIT_ACTIONS.CREATE,
          changes: { new: { id: 'u1' } },
          userId: 'admin',
          userRole: 'ADMIN',
          ipAddress: '1.1.1.1',
          userAgent: 'jest',
        },
      });
    });
  });

  describe('findMany', () => {
    it('aplica filtros y paginación y devuelve items + total', async () => {
      prisma.auditLog.findMany.mockResolvedValue([{ id: 'a1' }]);
      prisma.auditLog.count.mockResolvedValue(1);

      const result = await service.findMany(
        { entityType: 'User', action: AUDIT_ACTIONS.CREATE, from: new Date('2026-01-01') },
        { page: 2, pageSize: 10 },
      );

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          entityType: 'User',
          action: AUDIT_ACTIONS.CREATE,
          createdAt: { gte: new Date('2026-01-01') },
        },
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 10,
      });
      expect(result).toEqual({ items: [{ id: 'a1' }], total: 1, page: 2, pageSize: 10 });
    });

    it('sin filtros usa where vacío y página 1 por defecto', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);
      await service.findMany({}, {});
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });
  });

  describe('findByEntity', () => {
    it('filtra por entityType y entityId', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      await service.findByEntity('User', 'u1');
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { entityType: 'User', entityId: 'u1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findByUser', () => {
    it('filtra por userId', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      await service.findByUser('admin');
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { userId: 'admin' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `pnpm --filter @gestion-academica/api test -- audit.service`
Expected: FAIL — `Cannot find module './audit.service'`.

- [ ] **Step 3: Implementar `AuditService`**

Create `apps/api/src/modules/audit/audit.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import type { AuditAction } from '@gestion-academica/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuditContext } from './audit-context.service';

export interface AuditFilters {
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: AuditAction;
  from?: Date;
  to?: Date;
}

export interface Pagination {
  page?: number;
  pageSize?: number;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: {
    entityType: string;
    entityId: string;
    action: AuditAction;
    changes?: unknown;
    context: AuditContext;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        changes: input.changes as never,
        userId: input.context.userId,
        userRole: input.context.userRole,
        ipAddress: input.context.ipAddress,
        userAgent: input.context.userAgent,
      },
    });
  }

  async findMany(filters: AuditFilters, pagination: Pagination) {
    const page = pagination.page ?? 1;
    const pageSize = pagination.pageSize ?? 20;
    const where = this.buildWhere(filters);

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  findByEntity(entityType: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByUser(userId: string) {
    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private buildWhere(filters: AuditFilters) {
    const where: Record<string, unknown> = {};
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      };
    }
    return where;
  }
}
```

> Nota: el test de `count` para `findMany` se cubre con el mock que devuelve `1`/`0`; `Promise.all` llama a `findMany` y `count` con el mismo `where`.

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `pnpm --filter @gestion-academica/api test -- audit.service`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/audit/audit.service.ts apps/api/src/modules/audit/audit.service.spec.ts
git commit -m "feat(api): AuditService con log y consultas filtradas/paginadas"
```

---

## Task 7: DTO, `AuditController` y `AuditModule`

**Files:**

- Create: `apps/api/src/modules/audit/dto/audit-query.dto.ts`
- Create: `apps/api/src/modules/audit/audit.controller.ts`
- Test: `apps/api/src/modules/audit/audit.controller.spec.ts`
- Create: `apps/api/src/modules/audit/audit.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Crear el DTO de filtros**

Create `apps/api/src/modules/audit/dto/audit-query.dto.ts`:

```typescript
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { AUDIT_ACTIONS } from '@gestion-academica/shared';
import type { AuditAction } from '@gestion-academica/shared';

const ACTION_VALUES = Object.values(AUDIT_ACTIONS);

export class AuditQueryDto {
  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsIn(ACTION_VALUES)
  action?: AuditAction;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
```

- [ ] **Step 2: Escribir el test del controller que falla**

Create `apps/api/src/modules/audit/audit.controller.spec.ts`:

```typescript
import { AuditController } from './audit.controller';

describe('AuditController', () => {
  let auditService: {
    findMany: jest.Mock;
    findByEntity: jest.Mock;
    findByUser: jest.Mock;
  };
  let controller: AuditController;

  beforeEach(() => {
    auditService = { findMany: jest.fn(), findByEntity: jest.fn(), findByUser: jest.fn() };
    controller = new AuditController(auditService as never);
  });

  it('list delega en findMany separando filtros de paginación', async () => {
    const page = { items: [], total: 0, page: 1, pageSize: 20 };
    auditService.findMany.mockResolvedValue(page);

    const query = { entityType: 'User', page: 1, pageSize: 20 } as never;
    await expect(controller.list(query)).resolves.toBe(page);
    expect(auditService.findMany).toHaveBeenCalledWith(
      {
        entityType: 'User',
        entityId: undefined,
        userId: undefined,
        action: undefined,
        from: undefined,
        to: undefined,
      },
      { page: 1, pageSize: 20 },
    );
  });

  it('byEntity delega en findByEntity', async () => {
    auditService.findByEntity.mockResolvedValue([]);
    await controller.byEntity('User', 'u1');
    expect(auditService.findByEntity).toHaveBeenCalledWith('User', 'u1');
  });

  it('byUser delega en findByUser', async () => {
    auditService.findByUser.mockResolvedValue([]);
    await controller.byUser('admin');
    expect(auditService.findByUser).toHaveBeenCalledWith('admin');
  });
});
```

- [ ] **Step 3: Correr el test para verificar que falla**

Run: `pnpm --filter @gestion-academica/api test -- audit.controller`
Expected: FAIL — `Cannot find module './audit.controller'`.

- [ ] **Step 4: Implementar `AuditController`**

Create `apps/api/src/modules/audit/audit.controller.ts`:

```typescript
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ROLES } from '@gestion-academica/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';

@Controller('audit-logs')
@Roles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DIRECTOR)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  list(@Query() query: AuditQueryDto) {
    const { page, pageSize, ...filters } = query;
    return this.auditService.findMany(
      {
        entityType: filters.entityType,
        entityId: filters.entityId,
        userId: filters.userId,
        action: filters.action,
        from: filters.from,
        to: filters.to,
      },
      { page, pageSize },
    );
  }

  @Get('entity/:entityType/:entityId')
  byEntity(@Param('entityType') entityType: string, @Param('entityId') entityId: string) {
    return this.auditService.findByEntity(entityType, entityId);
  }

  @Get('user/:userId')
  byUser(@Param('userId') userId: string) {
    return this.auditService.findByUser(userId);
  }
}
```

> El `@Roles` a nivel de clase aplica a los 3 endpoints. El `JwtAuthGuard` global ya exige token; el `RolesGuard` global aplica el rol. Sin token → 401; rol no permitido → 403.

- [ ] **Step 5: Crear `AuditModule`**

Create `apps/api/src/modules/audit/audit.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
```

- [ ] **Step 6: Importar `AuditModule` en `AppModule`**

En `apps/api/src/app.module.ts`, agregar el import (junto a los demás módulos):

```typescript
import { AuditModule } from './modules/audit/audit.module';
```

Y agregarlo al array `imports` del `@Module`, después de `AuthModule`:

```typescript
    AuthModule,
    AuditModule,
```

- [ ] **Step 7: Correr el test del controller y verificar build**

Run: `pnpm --filter @gestion-academica/api test -- audit.controller`
Expected: PASS — 3 tests.

Run: `pnpm --filter @gestion-academica/api build`
Expected: build exitoso.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/audit/dto/audit-query.dto.ts apps/api/src/modules/audit/audit.controller.ts apps/api/src/modules/audit/audit.controller.spec.ts apps/api/src/modules/audit/audit.module.ts apps/api/src/app.module.ts
git commit -m "feat(api): AuditController y AuditModule con consulta de logs por rol"
```

---

## Task 8: Tests e2e

**Files:**

- Modify: `apps/api/test/auth.e2e-spec.ts`
- Create: `apps/api/test/audit.e2e-spec.ts`

- [ ] **Step 1: Arreglar el teardown de `auth.e2e-spec.ts` (FK de audit_logs)**

`AuditLog.userId` referencia `users` con `onDelete: Restrict`. Como ahora `POST /auth/register` genera audit logs cuyo `userId` es el actor (el SUPER_ADMIN de prueba), borrar ese usuario en el `afterAll` fallaría. Hay que borrar los `audit_logs` de esos usuarios primero.

En `apps/api/test/auth.e2e-spec.ts`, en el `afterAll`, **antes** del `prisma.user.deleteMany`, agregar:

```typescript
await prisma.auditLog.deleteMany({
  where: { user: { email: { endsWith: TEST_EMAIL_DOMAIN } } },
});
```

El `afterAll` queda con este orden: `refreshToken.deleteMany` → `auditLog.deleteMany` → `user.deleteMany` → `app.close()`.

- [ ] **Step 2: Correr el e2e de auth para verificar que sigue verde**

Requiere Postgres levantado y migrado. Run: `pnpm --filter @gestion-academica/api test:e2e -- auth`
Expected: PASS — `auth.e2e-spec.ts` (incluye el flujo de register, que ahora además audita).

- [ ] **Step 3: Escribir el e2e de auditoría**

Create `apps/api/test/audit.e2e-spec.ts`:

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

const DOMAIN = '@e2e-audit.local';
const SUPERADMIN_EMAIL = `superadmin${DOMAIN}`;
const SUPERADMIN_PASSWORD = 'superadmin-e2e-pass';
const PROFESOR_EMAIL = `profesor${DOMAIN}`;
const PROFESOR_PASSWORD = 'profesor-e2e-pass';

describe('Audit (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  async function cleanup() {
    await prisma.auditLog.deleteMany({ where: { user: { email: { endsWith: DOMAIN } } } });
    await prisma.refreshToken.deleteMany({ where: { user: { email: { endsWith: DOMAIN } } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(Logger));
    configureApp(app, app.get<ConfigService<Env, true>>(ConfigService));
    await app.init();

    prisma = app.get(PrismaService);
    await cleanup();
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
    await cleanup();
    await app.close();
  });

  async function login(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.data.accessToken;
  }

  it('POST /auth/register audita la creación del User con password redactado', async () => {
    const token = await login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    const nuevoEmail = `creado${DOMAIN}`;

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: nuevoEmail, password: 'secret1', role: 'PROFESOR' })
      .expect(201);

    // La escritura del log es fire-and-forget; damos un pequeño margen.
    await new Promise((r) => setTimeout(r, 200));

    const created = await prisma.user.findUnique({ where: { email: nuevoEmail } });
    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'User', entityId: created!.id },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('CREATE');
    expect(logs[0].userRole).toBe('SUPER_ADMIN');
    const changes = logs[0].changes as { new: Record<string, unknown> };
    expect(changes.new.email).toBe(nuevoEmail);
    expect(changes.new.password).toBe('[REDACTED]');
  });

  it('GET /audit-logs como SUPER_ADMIN → 200 con items', async () => {
    const token = await login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    const res = await request(app.getHttpServer())
      .get('/api/v1/audit-logs?entityType=User')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.total).toBeGreaterThanOrEqual(1);
  });

  it('GET /audit-logs como PROFESOR → 403', async () => {
    const token = await login(PROFESOR_EMAIL, PROFESOR_PASSWORD);
    await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /audit-logs sin token → 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/audit-logs').expect(401);
  });
});
```

- [ ] **Step 4: Correr toda la suite e2e**

Run: `pnpm --filter @gestion-academica/api test:e2e`
Expected: PASS — `app.e2e-spec.ts`, `auth.e2e-spec.ts` y `audit.e2e-spec.ts`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/test/auth.e2e-spec.ts apps/api/test/audit.e2e-spec.ts
git commit -m "test(api): e2e de auditoría (register audita; consulta por rol) y fix de teardown"
```

---

## Task 9: Gate de verificación final

**Files:** ninguno nuevo — solo verificación; commit únicamente si lint/format generan cambios.

- [ ] **Step 1: Lint**

Run: `pnpm --filter @gestion-academica/api lint`
Expected: sin errores.

- [ ] **Step 2: Format check**

Run: `pnpm format:check`
Expected: limpio. Si falla, correr `pnpm prettier --write` sobre los archivos marcados.

- [ ] **Step 3: Build**

Run: `pnpm --filter @gestion-academica/api build`
Expected: build exitoso.

- [ ] **Step 4: Suite unitaria completa**

Run: `pnpm --filter @gestion-academica/api test`
Expected: PASS — toda la suite.

- [ ] **Step 5: Suite e2e completa**

Run: `pnpm --filter @gestion-academica/api test:e2e`
Expected: PASS — toda la suite e2e.

- [ ] **Step 6: Commit (solo si lint/format modificaron archivos)**

```bash
git add -A
git commit -m "style(api): arreglos de lint/format en el módulo de auditoría"
```

- [ ] **Step 7: Listo para PR**

La rama `feature/72-auditoria` queda lista. El cuerpo del PR debe incluir `Closes #72` (número nativo de GitHub) y **no** mencionar a Claude ni a ninguna IA. Actualizar la documentación `docs/AUTHORIZATION.md` no es necesario (la auditoría no cambia el modelo de permisos).

---

## Criterios de aceptación (issue #72)

- [ ] Cualquier cambio en una entidad del allowlist se registra automáticamente → Task 4 (extensión) + Task 8 (e2e).
- [ ] Los cambios incluyen `old` y `new` → Task 3 (`computeChanges`) + Task 8.
- [ ] Los logs se escriben sin afectar el endpoint principal → Task 4 (fire-and-forget).
- [ ] Solo SUPER_ADMIN/ADMIN/DIRECTOR pueden consultar → Task 7 (`@Roles`) + Task 8.
- [ ] Tests (unit + e2e) pasan → Task 9.

```

```
