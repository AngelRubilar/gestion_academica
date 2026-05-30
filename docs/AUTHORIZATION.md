# Autorización — Roles y permisos

Modelo de autenticación y autorización del backend. Define quién puede acceder a
qué y cómo se aplica en el código.

> Issue de referencia: `[B1-08]` (#8). Implementado sobre el módulo de auth del
> `[B1-06]` (#6).

## Modelo: autenticado por defecto

El backend registra **dos guards globales** (`APP_GUARD` en `app.module.ts`),
que corren después del `ThrottlerGuard`:

1. **`JwtAuthGuard`** — valida el access token JWT y puebla `request.user` con el
   `RequestUser` (`{ id, email, role }`). Si falta el token o es inválido → `401`.
2. **`RolesGuard`** — si el handler/clase declara `@Roles(...)`, exige que
   `request.user.role` esté en la lista; si no → `403`. Sin `@Roles`, deja pasar.

**Consecuencia:** toda ruta queda autenticada por defecto. No hay que agregar
`@UseGuards` por endpoint.

### Abrir o restringir rutas

| Decorador          | Efecto                                                 | Ejemplo                                        |
| ------------------ | ------------------------------------------------------ | ---------------------------------------------- |
| `@Public()`        | La ruta se sirve **sin token** (salta `JwtAuthGuard`). | `login`, `refresh`, `logout`, `GET /health`    |
| `@Roles(rol, ...)` | Solo esos roles acceden; el resto recibe `403`.        | `POST /auth/register` → `SUPER_ADMIN`, `ADMIN` |
| _(ninguno)_        | Autenticado, cualquier rol.                            | CRUDs de lectura general                       |

`@Public()` y `@Roles()` se pueden poner a nivel de método o de clase
(`getAllAndOverride` resuelve método sobre clase).

El usuario inactivo (`isActive = false`) se rechaza en `JwtStrategy.validate`
(→ `401`), aunque el token sea válido.

## Roles del sistema

Fuente de verdad: `ROLES` en `@gestion-academica/shared`.

| Rol             | Nivel de acceso                                                   |
| --------------- | ----------------------------------------------------------------- |
| `SUPER_ADMIN`   | Configuración técnica y mantenimiento. Puede crear cualquier rol. |
| `ADMIN`         | Gestión completa del colegio. **No** puede crear `SUPER_ADMIN`.   |
| `DIRECTOR`      | Lectura global, dashboards.                                       |
| `PROFESOR_JEFE` | Su curso (jefatura) + funciones de profesor.                      |
| `PROFESOR`      | Sus asignaturas/cursos asignados.                                 |
| `ESTUDIANTE`    | Su propia información.                                            |
| `APODERADO`     | Información de sus pupilos.                                       |

### Sub-regla de creación de usuarios

En `POST /auth/register` (ver `AuthService.register`): un `ADMIN` no puede crear
un `SUPER_ADMIN` (→ `403`, antes de tocar la BD). Un `SUPER_ADMIN` puede crear
cualquier rol.

## Matriz de permisos por operación

`@Roles(...)` cubre la autorización **a nivel de ruta** (qué rol entra al
endpoint). La granularidad **a nivel de recurso** ("este profesor solo ve _sus_
cursos", "este apoderado solo ve a _sus_ pupilos") se resuelve dentro de cada
servicio cuando exista el CRUD correspondiente — no es responsabilidad del guard.

| Operación                         | Roles permitidos (ruta)                 | Filtro a nivel de recurso         |
| --------------------------------- | --------------------------------------- | --------------------------------- |
| Crear usuarios (`/auth/register`) | `SUPER_ADMIN`, `ADMIN`                  | —                                 |
| CRUD usuarios / personas          | `SUPER_ADMIN`, `ADMIN`                  | —                                 |
| CRUD cursos / asignaturas         | `SUPER_ADMIN`, `ADMIN`                  | —                                 |
| Lectura de dashboards globales    | `SUPER_ADMIN`, `ADMIN`, `DIRECTOR`      | —                                 |
| Gestión de notas/evaluaciones     | `PROFESOR`, `PROFESOR_JEFE` (+ `ADMIN`) | Solo cursos/asignaturas asignados |
| Ver notas/asistencia propias      | `ESTUDIANTE`                            | Solo el propio `studentId`        |
| Ver información de pupilos        | `APODERADO`                             | Solo alumnos vinculados           |

> Esta tabla es el contrato de referencia. Cada issue de CRUD (Bloque 2 en
> adelante) debe aplicar el `@Roles(...)` correspondiente y el filtro de recurso
> en su servicio, y actualizar esta tabla si introduce una operación nueva.
