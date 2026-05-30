# Sistema de Auditoría — Diseño

> Issue: `[B0-71]` (#72). Dependencias: #3 (schema, modelo `AuditLog`), #4 (config base NestJS), #6/#8 (auth + contexto de usuario en `request.user`).

## Objetivo

Registrar automáticamente cada cambio (CREATE / UPDATE / DELETE / DEACTIVATE / REACTIVATE) sobre las entidades de dominio clave, con el diff `old → new`, el usuario que lo hizo y su contexto de request (IP, user-agent), sin bloquear el endpoint principal. Exponer endpoints de consulta restringidos por rol.

## Enfoque y desviación de la issue

La issue proponía un decorador `@Auditable(entityType)` sobre los controladores + un `AuditInterceptor` HTTP. **Este diseño lo reemplaza** por una **extensión de Prisma Client** que audita a nivel de base de datos:

- El `entityType` es el nombre del modelo Prisma (no hay que declararlo por controlador).
- Captura _cualquier_ escritura sobre un modelo auditado, venga o no de un controlador HTTP — cumple mejor el criterio "cualquier cambio se registra automáticamente".
- El contexto de usuario (que solo vive en la request HTTP) viaja hasta la capa de datos vía `AsyncLocalStorage`.

Esta desviación fue aprobada explícitamente durante el brainstorming (2026-05-30).

## Modelo de datos (ya existe en el schema)

```prisma
model AuditLog {
  id         String      @id @default(uuid())
  entityType String
  entityId   String
  action     AuditAction        // CREATE | UPDATE | DEACTIVATE | REACTIVATE | DELETE
  changes    Json?
  userId     String
  userRole   Role
  ipAddress  String?
  userAgent  String?
  createdAt  DateTime    @default(now())
  user       User        @relation(fields: [userId], references: [id])

  @@index([entityType, entityId])
  @@index([userId])
  @@index([createdAt])
  @@map("audit_logs")
}
```

No requiere migración. `userId` es obligatorio y tiene FK a `users` — por eso las escrituras sin contexto de usuario **no** se auditan (ver Allowlist).

## Componentes

### 1. `AuditContextService` (AsyncLocalStorage)

Envuelve un `AsyncLocalStorage<AuditContext>` donde `AuditContext = { userId, userRole, ipAddress?, userAgent? }`.

- `run(ctx, fn)` — ejecuta `fn` dentro del store.
- `get()` — devuelve el contexto actual o `undefined`.

### 2. `AuditContextInterceptor` (global)

Interceptor global registrado como `APP_INTERCEPTOR`. Corre **después** de los guards (orden de NestJS: guards → interceptores), así `request.user` ya está poblado por `JwtAuthGuard`.

- Si hay `request.user`: arma el `AuditContext` con `user.id`, `user.role`, `request.ip` y el header `user-agent`, y corre el resto del pipeline dentro de `auditContext.run(ctx, ...)`.
- Si no hay user (rutas `@Public`): corre sin contexto.

Orden relativo a los interceptores existentes: debe envolver a los handlers, así que se registra de forma que su `als.run` cubra la ejecución. Se registra junto a `LoggingInterceptor`/`TransformInterceptor` en `AppModule`.

### 3. Extensión de auditoría de Prisma

Una extensión `query` (`prisma.$extends`) aplicada en `PrismaService`, activa solo para modelos del **allowlist**. Para las operaciones `create`, `update`, `delete`, `upsert`:

1. **Pre-image:** en `update` / `delete` / `upsert`, lee el registro actual (`findUnique` por `args.where`) **antes** de ejecutar la operación. En `create` no hay pre-image.
2. Ejecuta la operación; el resultado es el **post-image**.
3. **Deriva la acción:**
   - `create` → `CREATE`
   - `delete` → `DELETE`
   - `update` / `upsert`:
     - si `isActive` cambió `true → false` → `DEACTIVATE`
     - si `isActive` cambió `false → true` → `REACTIVATE`
     - en otro caso → `UPDATE` (o `CREATE` si el upsert insertó)
4. **Calcula `changes`:**
   - `CREATE` → `{ new: <snapshot redactado> }`
   - `UPDATE` / `DEACTIVATE` / `REACTIVATE` → `{ <campo>: { old, new } }` solo para los campos que cambiaron
   - `DELETE` → `{ old: <snapshot redactado> }`
5. **Redacción:** los campos sensibles (`password`, `tokenHash`) se reemplazan por `'[REDACTED]'` en cualquier snapshot/diff.
6. **Escritura:**
   - Si `AuditContextService.get()` es `undefined` → se omite el log (operación de sistema/seed) y se deja un `debug`.
   - Si hay contexto → insert **fire-and-forget** en `auditLog` (no se hace `await`; se adjunta `.catch` que loguea el error) para no bloquear la request. Como `AuditLog` **no** está en el allowlist, no hay recursión.

`entityId` se toma del `id` del post-image (o del pre-image en `delete`).

### 4. `AuditService`

- `log(input: { entityType, entityId, action, changes?, context })` — inserta una fila de auditoría. Es la API manual y también la que usa la extensión.
- `findMany(filtros, paginación)` — lista con filtros opcionales `entityType`, `entityId`, `userId`, `action`, `from`, `to`; ordenado por `createdAt desc`; paginado.
- `findByEntity(entityType, entityId)` — historial de una entidad.
- `findByUser(userId)` — acciones de un usuario.

### 5. `AuditController` — `/audit-logs`

Protegido con `@Roles(SUPER_ADMIN, ADMIN, DIRECTOR)` (todos lectura; los tres roles permitidos según la issue). El resto → `403`; sin token → `401` (guard global).

- `GET /audit-logs` — query params: `entityType?`, `entityId?`, `userId?`, `action?`, `from?`, `to?`, `page?`, `pageSize?`.
- `GET /audit-logs/entity/:entityType/:entityId`
- `GET /audit-logs/user/:userId`

### 6. `AuditModule` (`@Global`)

Provee `AuditService` y `AuditContextService` (exportados); declara `AuditController`. La extensión de Prisma se monta en `PrismaService`, que consume `AuditContextService` y un cliente base para escribir los logs.

## Wiring de la extensión en `PrismaService`

`PrismaService` hoy extiende `PrismaClient` directamente. Como `$extends` devuelve un **cliente nuevo** (no muta en sitio), la extensión se aplica exponiendo el cliente extendido como el inyectable, preservando los hooks `onModuleInit`/`onModuleDestroy`. El mecanismo exacto (factory provider vs getter) se decide en el plan; el `AuditContextService` se inyecta en la construcción de la extensión.

## Allowlist de entidades

Constante central (`AUDITED_MODELS`). Inicialmente contiene **`User`** — el único modelo de dominio con escritura por HTTP autenticada hoy (`POST /auth/register`). Cada issue de CRUD futura agrega su modelo. `RefreshToken` y `AuditLog` quedan fuera por definición.

## Estrategia de testing (TDD)

- **Unit:**
  - Derivación de acción y cálculo de `changes` + redacción (funciones puras) — tabla de casos: create, update de campos normales, deactivate, reactivate, delete.
  - `AuditService.log` y métodos de consulta con Prisma mockeado.
  - `AuditContextService.run/get` y el interceptor poblando el ALS.
- **E2E:**
  - `POST /auth/register` crea un `User` → assert fila en `audit_logs`: `entityType='User'`, `action='CREATE'`, `userId`/`userRole` del creador, `password` redactado.
  - `GET /audit-logs` y variantes: `DIRECTOR` lee (200), `PROFESOR` → 403, sin token → 401, filtros funcionan.

## Performance

- Escrituras de log **fire-and-forget** (no bloquean el endpoint).
- Índices ya presentes en el schema (`(entityType, entityId)`, `userId`, `createdAt`).
- Pre-image agrega una query extra por escritura auditada — costo aceptable.

## Fuera de alcance (YAGNI)

- Operaciones masivas (`createMany` / `updateMany` / `deleteMany`) — no se auditan en v1 (documentado).
- Particionamiento de la tabla por fecha — futuro, cuando el volumen lo justifique.
- Usuario `SYSTEM` de fallback — las escrituras sin contexto simplemente se omiten.

## Criterios de aceptación (issue #72)

- [ ] Cualquier cambio en una entidad del allowlist se registra automáticamente → extensión Prisma.
- [ ] Los cambios incluyen `old` y `new` → cálculo de `changes`.
- [ ] Los logs se escriben sin afectar el endpoint principal → fire-and-forget.
- [ ] Solo SUPER_ADMIN/ADMIN/DIRECTOR pueden consultar → `@Roles` en `AuditController`.
- [ ] Tests (unit + e2e) pasan.
