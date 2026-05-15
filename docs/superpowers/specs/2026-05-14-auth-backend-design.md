# Diseño — Auth backend: Login y registro (JWT + refresh tokens)

- **Issue:** #6 — [B1-06] Backend: Login y registro (JWT + refresh tokens)
- **Fecha:** 2026-05-14
- **Estado:** Aprobado — listo para plan de implementación
- **Depende de:** #4 (config base NestJS) — mergeado

## Objetivo

Implementar autenticación con JWT (access token) + refresh tokens con rotación en
NestJS. Este issue es el *keystone* del backend: hace funcionar los stubs ya
existentes `RolesGuard`, `@CurrentUser()` y el tipo `RequestUser`, que hoy denegan
todo endpoint protegido porque nadie puebla `request.user`.

## Alcance

### Dentro

- Módulo `auth` con `AuthController`, `AuthService`, `RefreshTokenService`, `JwtStrategy`.
- `JwtAuthGuard` en `common/guards/` (junto a `RolesGuard`).
- 4 endpoints: `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`.
- Hash de passwords con bcrypt.
- Refresh tokens opacos con rotación, hash en BD y detección de reuso.
- Migración de schema de `RefreshToken`.
- Tests unitarios + e2e.

### Fuera (otros issues)

- CRUD de usuarios (`UsersModule`) y de personas (Teacher/Student/Guardian).
- Recuperación de contraseña (`PasswordReset` ya existe en el schema, pero sus
  endpoints no son parte de #6).
- Logout global (invalidar todas las sesiones de un usuario).
- Limpieza periódica de refresh tokens expirados/revocados.

## Decisiones tomadas

1. **`POST /auth/register` crea solo el `User`.** No crea el perfil vinculado
   (Teacher/Student/Guardian); eso lo manejan los issues de CRUD de personas.
   Coincide con `createUserSchema` del paquete `shared`.
2. **Ambos tokens viajan en el body JSON.** `login`/`refresh` devuelven
   `accessToken` y `refreshToken` en el cuerpo de la respuesta. El cliente los
   guarda y los envía. Es lo que pide el issue y lo más simple de testear.
3. **Refresh token: rotación + hash en BD + detección de reuso.** Token opaco
   aleatorio; en BD se guarda su `sha256`. Cada `/auth/refresh` invalida el viejo
   y emite uno nuevo. Si llega un token ya revocado → se revocan todos los refresh
   tokens del usuario.
4. **Enfoque A: `AuthModule` autocontenido, guards opt-in.** `AuthService` habla
   directo con Prisma. Los guards se aplican por controlador con
   `@UseGuards(JwtAuthGuard, RolesGuard)`, como muestra `ARCHITECTURE.md`. No se
   crea `UsersModule` a medias.

## Estado previo (ya existe, no se crea)

- **Schema Prisma:** `User` (email, password, role, isActive, timestamps),
  `RefreshToken`, `PasswordReset`.
- **Stubs esperando este issue:** `RolesGuard`, `@CurrentUser()`, `@Roles()`,
  tipo `RequestUser { id, email, role }` (en `apps/api/src/common/`).
- **Env validado:** `JWT_SECRET` (min 32 chars), `JWT_ACCESS_EXPIRES_IN` (`15m`),
  `JWT_REFRESH_EXPIRES_IN` (`7d`).
- **Infra global:** `ThrottlerGuard` (100 req/60s), `ValidationPipe` con
  `whitelist`, `TransformInterceptor` (envuelve OK en `{ data }`),
  `HttpExceptionFilter` (formato de error uniforme).
- **Seed:** un `SUPER_ADMIN` (`superadmin@gestion-academica.local` /
  `superadmin123`).
- **Convenciones:** módulo por dominio (controller/service/dto/specs), DTOs con
  `class-validator`, tests AAA con descripciones en español
  (`CODING_STYLE.md`).

## Arquitectura — estructura de archivos

```
apps/api/src/modules/auth/
├── auth.module.ts
├── auth.controller.ts          # solo HTTP: rutas, DTOs, status codes
├── auth.service.ts             # orquestación: register, login, refresh, logout
├── refresh-token.service.ts    # ciclo de vida del refresh token
├── strategies/
│   └── jwt.strategy.ts         # valida el access token, devuelve RequestUser
├── dto/
│   ├── register.dto.ts
│   ├── login.dto.ts
│   ├── refresh.dto.ts
│   └── logout.dto.ts
├── auth.service.spec.ts
├── refresh-token.service.spec.ts
└── auth.controller.spec.ts

apps/api/src/common/guards/
└── jwt-auth.guard.ts           # nuevo, junto a roles.guard.ts; exportado en common/index.ts

apps/api/test/
└── auth.e2e-spec.ts
```

### Responsabilidades

| Unidad | Responsabilidad | Depende de |
|---|---|---|
| `AuthController` | Solo HTTP: rutas, DTOs, status codes. Sin lógica. | `AuthService` |
| `AuthService` | Orquesta. Valida credenciales, hashea passwords (bcrypt, cost 10), emite access tokens vía `JwtService`, delega refresh tokens. | `PrismaService`, `JwtService`, `RefreshTokenService` |
| `RefreshTokenService` | Dueño exclusivo del ciclo de vida del refresh token: emitir, rotar, validar-y-consumir, revocar, detección de reuso. | `PrismaService`, `ConfigService` |
| `JwtStrategy` | Provider de passport. Valida el access token, recarga el `User`, verifica `isActive`, devuelve `RequestUser`. | `PrismaService`, `ConfigService` |
| `JwtAuthGuard` | Wrapper de `AuthGuard('jwt')`. Vive en `common/guards/`. | — |

**Por qué `JwtAuthGuard` en `common/` y `JwtStrategy` en `auth/`:** la strategy
debe registrarse como provider de un módulo (`AuthModule`); el guard es solo
`AuthGuard('jwt')` y funciona desde cualquier lado mientras `AuthModule` esté
importado en `AppModule`. Ponerlo en `common/` evita que cada controlador de
dominio futuro importe `AuthModule` solo para el guard, y lo deja junto a
`RolesGuard` (los dos guards que usan los controladores quedan juntos).

## Contratos de endpoints

Todos bajo `/api/v1/auth` (prefijo `api` + versión `1` ya configurados). Las
respuestas OK las envuelve el `TransformInterceptor` en `{ data }`; los errores
salen con el formato uniforme del `HttpExceptionFilter`.

### `POST /auth/register` — protegido

- Guards: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(SUPER_ADMIN, ADMIN)`.
- Body `RegisterDto`:
  - `email` — `@IsEmail`; se normaliza a lowercase + trim.
  - `password` — `@MinLength(6)` (igual que `createUserSchema` de `shared`).
  - `role` — `@IsIn` de `ROLES`.
- **Sub-regla de roles:** SUPER_ADMIN puede crear cualquier rol; ADMIN puede crear
  cualquiera **excepto SUPER_ADMIN** (si lo intenta → `403 Forbidden`). Evita
  escalada de privilegios.
- Email duplicado → `409 Conflict` ("El email ya está registrado").
- Éxito → `201` con `{ id, email, role, isActive, createdAt }`. **Nunca** el
  password.

### `POST /auth/login` — público

- Body `LoginDto`: `email`, `password`.
- Usuario inexistente / password incorrecto / usuario inactivo → siempre el mismo
  `401 Unauthorized` ("Credenciales inválidas"). No filtra si el email existe.
- La comparación bcrypt se ejecuta **siempre**, incluso si el email no existe
  (compare contra un hash dummy), para no filtrar usuarios por timing.
- Throttle propio más estricto que el global: `@Throttle` de 10 requests / 60s en
  login, por ser blanco de fuerza bruta.
- Éxito → `200` con `{ accessToken, refreshToken, user: { id, email, role } }`.

### `POST /auth/refresh` — público

El refresh token *es* la credencial.

- Body `RefreshDto`: `refreshToken`.
- Token no encontrado / expirado / usuario inactivo → `401` ("Refresh token
  inválido").
- Token ya revocado (reuso detectado) → se revocan **todos** los refresh tokens
  del usuario → `401`.
- Token activo → rota (marca `revokedAt` en el viejo, crea uno nuevo) → `200` con
  `{ accessToken, refreshToken }`.

### `POST /auth/logout` — sin guard

Poseer el refresh token basta para invalidarlo.

- Body `LogoutDto`: `refreshToken`.
- Marca `revokedAt` en ese token. Idempotente: si no existe, igual responde OK
  (no filtra nada).
- Éxito → `204 No Content`.

## Estrategia de tokens

### Access token (JWT)

- Firmado con `JWT_SECRET`, `expiresIn: JWT_ACCESS_EXPIRES_IN` (`15m`).
- Payload: `{ sub: user.id, email: user.email, role: user.role }`.
- Emitido vía `@nestjs/jwt` `JwtService`; `JwtModule.registerAsync` lee de
  `ConfigService`.
- `JwtStrategy.validate` recarga el `User` desde BD, verifica `isActive`, y
  devuelve `RequestUser { id, email, role }`.

### Refresh token (opaco, no JWT)

- `crypto.randomBytes(32).toString('hex')` → string de 64 chars que se devuelve al
  cliente.
- En BD se guarda **solo el `sha256(token)`** en hex, nunca el valor crudo.
- sha256 (no bcrypt) porque el token es aleatorio de alta entropía: no necesita
  hash lento y permite lookup directo indexado por hash. bcrypt queda reservado
  para passwords (baja entropía, requiere hash lento).
- `expiresAt = now + JWT_REFRESH_EXPIRES_IN`; el `"7d"` se parsea con un helper
  local `parseDuration` (regex simple, sin dependencia externa).
- **Rotación:** al rotar se setea `revokedAt` en el token viejo (no se borra) y se
  crea uno nuevo. Así un token reusado se detecta.
- **Detección de reuso:** si llega un token cuyo registro tiene `revokedAt`
  seteado → se revocan todos los refresh tokens de ese usuario.

## Migración de schema

Modelo `RefreshToken` en `apps/api/prisma/schema.prisma`:

```prisma
model RefreshToken {
  id        String    @id @default(uuid())
  tokenHash String    @unique          // renombrado de `token` — guarda sha256, no el valor crudo
  userId    String
  expiresAt DateTime
  revokedAt DateTime?                  // nuevo — null = activo; habilita detección de reuso
  createdAt DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("refresh_tokens")
}
```

- Cambios: renombrar `token` → `tokenHash`; agregar `revokedAt DateTime?`.
- Token activo = `revokedAt` null **y** no expirado.
- Migración: `prisma migrate dev --name auth_refresh_token_rotation`.
- La tabla no tiene datos productivos (proyecto en fundación), así que el rename
  no requiere data migration.

## Dependencias

- **Agregar a `dependencies`:** `@nestjs/jwt`, `@nestjs/passport`, `passport`,
  `passport-jwt`.
- **Agregar a `devDependencies`:** `@types/passport-jwt`.
- **Mover** `bcrypt` de `devDependencies` → `dependencies` (el `AuthService` lo usa
  en runtime; hoy solo funciona porque el seed corre con ts-node). `@types/bcrypt`
  se queda en `devDependencies`.
- Sin cambios en el env schema: `JWT_SECRET`, `JWT_ACCESS_EXPIRES_IN`,
  `JWT_REFRESH_EXPIRES_IN` ya están definidos y validados.

## Manejo de errores

Todo vía el `HttpExceptionFilter` existente, con excepciones de NestJS y mensajes
en español:

| Excepción | Status | Caso |
|---|---|---|
| `ConflictException` | 409 | Email ya registrado en register |
| `UnauthorizedException` | 401 | Credenciales inválidas; refresh token inválido/expirado/revocado; usuario inactivo |
| `ForbiddenException` | 403 | `RolesGuard` cuando el rol no alcanza; ADMIN intentando crear SUPER_ADMIN |
| `BadRequestException` | 400 | `ValidationPipe` global sobre DTOs malformados |

- Mensajes de auth genéricos (no filtran si un usuario existe).
- En login, la comparación bcrypt corre siempre (hash dummy si el email no existe)
  para no filtrar usuarios por timing.

## Testing

### Unit (`*.spec.ts`, Prisma y `JwtService` mockeados, AAA, descripciones en español)

- **`AuthService`** — register (éxito; email duplicado → 409; password queda
  hasheado; ADMIN no puede crear SUPER_ADMIN → 403), login (éxito; password
  incorrecto → 401; email inexistente → 401; usuario inactivo → 401), refresh
  (rotación ok; expirado → 401; reuso → revoca todos + 401; usuario inactivo →
  401), logout (revoca el token; idempotente si no existe).
- **`RefreshTokenService`** — emitir (devuelve el crudo, guarda el hash),
  validar-y-consumir, rotar, detección de reuso revoca todos, revocar.
- **`JwtStrategy`** — `validate` devuelve `RequestUser`; rechaza si el usuario ya
  no existe o está inactivo.
- **`AuthController`** — con `AuthService` mockeado: cada ruta delega al método
  correcto del service y devuelve el status code esperado (201/200/204).

### E2e (`auth.e2e-spec.ts`, Postgres real — igual setup que `app.e2e-spec.ts`)

- `register` sin token → 401; con rol insuficiente → 403.
- Flujo completo: login con el SUPER_ADMIN del seed → tokens → el access token
  sirve en una ruta protegida (el propio `/auth/register`) → refresh rota los
  tokens → el refresh token viejo ahora da 401 (reuso) → logout → refresh falla.
- login con credenciales malas → 401.
- Limpieza: los tests borran en `afterAll` los usuarios que crearon (emails únicos
  por corrida) para no ensuciar la BD.

## Criterios de aceptación (del issue #6)

- [ ] Login retorna JWT válido.
- [ ] Refresh token renueva el access token.
- [ ] Passwords hasheados en BD.
- [ ] Tests (unit + e2e) pasan.
