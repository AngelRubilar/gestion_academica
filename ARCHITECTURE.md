# Architecture — Diseño técnico del sistema

Este documento explica las decisiones arquitectónicas del proyecto, los patrones de diseño que usamos y cómo está organizado el código. Léelo antes de implementar funcionalidades nuevas para que tu código sea consistente con el resto del sistema.

Para flujo de trabajo del equipo lee [CONTRIBUTING.md](./CONTRIBUTING.md). Para convenciones de código lee [CODING_STYLE.md](./CODING_STYLE.md).

## Vista general del sistema

La plataforma es un sistema cliente-servidor con tres aplicaciones que consumen una sola API:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web (Next)    │     │  Mobile (RN)    │     │   Admin Tools   │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────┬───────────┴───────────┬───────────┘
                     │                       │
              REST + WebSockets        REST + Push (FCM)
                     │                       │
                     v                       v
              ┌──────────────────────────────────┐
              │        API NestJS                │
              │  Controllers → Services → Prisma │
              └──────────┬───────────────────────┘
                         │
                ┌────────┴────────┐
                │                 │
                v                 v
         ┌──────────────┐   ┌──────────────┐
         │  PostgreSQL  │   │    Redis     │
         └──────────────┘   └──────────────┘
                │
                v
         ┌──────────────┐
         │    MinIO     │  (almacenamiento de archivos)
         └──────────────┘
```

### Decisiones clave

**TypeScript end-to-end:** un solo lenguaje en backend, frontend, mobile y código compartido. Los tipos definidos en `packages/shared` se consumen en todas las apps.

**Monorepo con Turborepo:** facilita compartir código y tipos. Cada app es independiente pero pueden referenciarse entre sí mediante workspaces de pnpm.

**Instancia por colegio:** cada colegio tiene su propio stack Docker independiente. No hay multi-tenencia a nivel de aplicación. La data de un colegio nunca se mezcla con otro.

**API REST + WebSockets:** REST para CRUD y operaciones síncronas. WebSockets (Socket.io) para notificaciones en tiempo real.

**PostgreSQL como única base de datos:** todos los datos relacionales viven aquí. No usamos NoSQL para datos académicos porque son altamente relacionales.

**Redis para cache y colas:** cache de queries costosas, colas de tareas asíncronas (envío de emails, generación de reportes).

**MinIO (S3-compatible) para archivos:** material educativo, fotos, documentos. Compatible con S3 si en el futuro se migra a la nube.

## Estructura del monorepo

```
gestion_academica/
├── apps/
│   ├── api/              # Backend NestJS
│   │   ├── prisma/       # Schema y migraciones
│   │   └── src/
│   │       ├── modules/  # Módulos de dominio (auth, users, courses, etc.)
│   │       ├── common/   # Guards, interceptors, filters, decorators
│   │       └── config/   # Configuración global
│   │
│   ├── web/              # Frontend Next.js
│   │   └── src/
│   │       ├── app/      # Rutas (App Router)
│   │       ├── components/
│   │       ├── hooks/
│   │       ├── lib/      # Cliente API, utils
│   │       └── providers/
│   │
│   └── mobile/           # App React Native (Expo)
│       └── src/
│           ├── screens/
│           ├── components/
│           └── navigation/
│
├── packages/
│   ├── shared/           # Tipos, validaciones (Zod), constantes
│   └── ui/               # Componentes UI compartidos web ↔ mobile
│
├── docker/
│   ├── dev/              # Solo infraestructura para dev local
│   └── prod/              # Stack completo de producción
│
├── docs/                 # Documentación específica del proyecto
└── .github/
    └── workflows/        # CI/CD
```

## Backend — NestJS

### Patrón: Module pattern

Cada dominio del sistema es un módulo de NestJS. No mezclamos lógica de distintos dominios en un mismo módulo.

```
apps/api/src/modules/
├── auth/
├── users/
├── students/
├── teachers/
├── guardians/
├── courses/
├── subjects/
├── evaluations/
├── grades/
├── attendance/
├── materials/
├── notifications/
├── audit/
└── ...
```

Cada módulo contiene:

```
modules/students/
├── students.module.ts        # Declara providers, imports, exports
├── students.controller.ts    # Endpoints HTTP
├── students.service.ts       # Lógica de negocio
├── dto/                       # Data Transfer Objects (validación)
│   ├── create-student.dto.ts
│   └── update-student.dto.ts
├── students.controller.spec.ts
└── students.service.spec.ts
```

### Patrón: Capas (Controller → Service → Repository)

Tres capas con responsabilidades claras:

**Controller**: solo HTTP. Recibe requests, delega al service, retorna response. No tiene lógica de negocio.

```typescript
@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @Roles('ADMIN', 'DIRECTOR')
  findAll(@Query() pagination: PaginationDto) {
    return this.studentsService.findAll(pagination);
  }
}
```

**Service**: lógica de negocio. Orquesta operaciones, aplica reglas, llama al repositorio.

```typescript
@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pagination: PaginationDto) {
    return this.prisma.student.findMany({
      where: { isActive: true },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
  }
}
```

**Repository (Prisma)**: acceso a datos. En este proyecto usamos `PrismaService` directamente desde el service. No abstraemos en una capa de repository custom (YAGNI).

### Patrón: DTO + class-validator

Todo input HTTP se valida con DTOs decorados.

```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateStudentDto {
  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @IsEmail()
  email: string;
}
```

Si el input no cumple el DTO, NestJS rechaza la request automáticamente con 400.

### Patrón: Dependency Injection

Nunca importamos clases directamente. Siempre las inyectamos por constructor.

```typescript
// ❌ MAL
import { PrismaService } from '../prisma/prisma.service';
const prisma = new PrismaService();

// ✅ BIEN
constructor(private readonly prisma: PrismaService) {}
```

### Patrón: Guards

Para autenticación y autorización a nivel de ruta.

```typescript
@Get()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'DIRECTOR')
findAll() { ... }
```

Guards comunes del proyecto:

- `JwtAuthGuard`: valida token JWT
- `RolesGuard`: valida rol del usuario
- `OwnershipGuard`: valida que el usuario sea dueño del recurso (ej: apoderado solo ve a sus hijos)

### Patrón: Interceptors

Para lógica transversal que aplica a múltiples endpoints.

Interceptors del proyecto:

- `LoggingInterceptor`: registra todas las requests
- `TransformInterceptor`: envuelve respuestas en `{ data: ... }`
- `AuditInterceptor`: registra cambios en `audit_logs` automáticamente

### Patrón: Filters

Para manejo global de errores. Convierte excepciones en respuestas HTTP consistentes.

```typescript
// Cualquier excepción se convierte en formato uniforme:
{
  "statusCode": 400,
  "message": "Email ya registrado",
  "error": "Bad Request",
  "timestamp": "2026-04-26T12:00:00.000Z"
}
```

### Comunicación con WebSockets

Para notificaciones en tiempo real. Cada usuario autenticado se conecta a una "room" privada y recibe sus notificaciones ahí.

```typescript
@WebSocketGateway()
export class NotificationsGateway {
  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, userId: string) {
    client.join(`user-${userId}`);
  }

  notifyUser(userId: string, notification: any) {
    this.server.to(`user-${userId}`).emit('notification', notification);
  }
}
```

## Frontend — Next.js

### Patrón: App Router con grupos de rutas

Usamos Next.js App Router con grupos para separar layouts.

```
apps/web/src/app/
├── (auth)/                # Layout sin sidebar
│   ├── login/
│   ├── register/
│   └── forgot-password/
├── (dashboard)/           # Layout con sidebar
│   ├── cursos/
│   ├── notas/
│   ├── asistencia/
│   └── ...
└── admin/                 # Panel de administración
```

### Patrón: Server Components por defecto, Client Components cuando necesario

**Server Components** (por defecto):

- Renderizan en el servidor
- No tienen estado ni eventos
- Pueden hacer fetch de datos directamente
- Mejor performance, menos JS al cliente

**Client Components** (con `'use client'`):

- Tienen estado (useState, useReducer)
- Tienen eventos (onClick, onChange)
- Necesarios para hooks de React (useEffect, useContext)
- Necesarios para librerías que tocan el DOM

Regla: empieza con Server Component. Solo agrega `'use client'` cuando lo necesites.

```tsx
// app/cursos/page.tsx (Server Component)
export default async function CoursesPage() {
  const courses = await fetchCourses();
  return <CoursesList courses={courses} />;
}

// components/CoursesList.tsx (Client Component)
'use client';
export function CoursesList({ courses }) {
  const [filter, setFilter] = useState('');
  return ...;
}
```

### Patrón: Composición de componentes

Componentes pequeños y enfocados que se componen entre sí.

```
components/
├── ui/                    # Primitivos (shadcn/ui): Button, Input, Card
└── domain/                # Componentes específicos del negocio
    ├── students/
    │   ├── StudentsTable.tsx
    │   ├── StudentForm.tsx
    │   └── StudentCard.tsx
    └── courses/
        ├── CoursesGrid.tsx
        └── CourseDetail.tsx
```

Regla: si un componente supera 200 líneas, dividirlo.

### Patrón: Custom hooks para lógica reutilizable

Cualquier lógica compleja que se use en más de un componente va en un custom hook.

```tsx
// hooks/useStudents.ts
export function useStudents(filters: StudentFilters) {
  return useQuery({
    queryKey: ['students', filters],
    queryFn: () => apiClient.get('/students', { params: filters }),
  });
}

// Uso en componente
function StudentsPage() {
  const { data, isLoading } = useStudents({ courseId: '123' });
  // ...
}
```

### Patrón: TanStack Query para datos del servidor

Toda llamada a la API se hace a través de TanStack Query. Maneja cache, revalidación, estados de carga y errores automáticamente.

```tsx
// Query (lectura)
const { data, isLoading } = useQuery({
  queryKey: ['students'],
  queryFn: fetchStudents,
});

// Mutation (escritura)
const mutation = useMutation({
  mutationFn: createStudent,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['students'] });
  },
});
```

### Patrón: Zustand para estado de UI

Para estado local del cliente que se comparte entre componentes (ej: filtros activos, sidebar abierto).

```tsx
// stores/uiStore.ts
export const useUIStore = create((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));

// Uso
const sidebarOpen = useUIStore((s) => s.sidebarOpen);
```

**No usamos Zustand para datos del servidor.** Eso es responsabilidad de TanStack Query.

### Patrón: react-hook-form + Zod para formularios

Toda validación de formulario se hace con Zod. Los esquemas Zod viven en `packages/shared` para reutilizarlos en backend.

```tsx
import { studentSchema } from '@gestion-academica/shared';

const form = useForm({
  resolver: zodResolver(studentSchema),
  defaultValues: { firstName: '', lastName: '', email: '' },
});
```

### Cliente API

Un único cliente API en `lib/api-client.ts`. Maneja:

- Inyección automática del token JWT
- Refresh automático del token al expirar
- Manejo uniforme de errores
- Base URL configurable por entorno

## Base de datos — Prisma + PostgreSQL

### Schema único

Un solo `schema.prisma` con todos los modelos. Si crece mucho, considerar split por área (Prisma 5.15+).

### Migraciones

- Las migraciones se generan con `prisma migrate dev --name <descripcion>`
- Cada migración se commitea junto con el cambio de código que la usa
- Nunca editamos manualmente una migración después de mergeada
- Para fixes en migraciones ya aplicadas, crear una nueva migración

### Soft delete

No borramos físicamente entidades académicas. Usamos `isActive: boolean`.

```typescript
// ❌ NO HACER
await prisma.course.delete({ where: { id } });

// ✅ HACER
await prisma.course.update({
  where: { id },
  data: { isActive: false },
});
```

### Audit fields

Entidades clave tienen `createdById` y `updatedById` que se completan automáticamente desde el usuario autenticado.

### Cómo evitar N+1 queries

Usar `include` o `select` para traer relaciones en una sola query.

```typescript
// ❌ N+1
const courses = await prisma.course.findMany();
for (const course of courses) {
  const students = await prisma.studentCourse.findMany({ where: { courseId: course.id } });
}

// ✅ Una sola query
const courses = await prisma.course.findMany({
  include: { studentCourses: { include: { student: true } } },
});
```

## Patrones de seguridad

### Autenticación: JWT con refresh tokens

- **Access token**: vida corta (15 min), se envía en cada request
- **Refresh token**: vida larga (7 días), se almacena en BD y se usa para renovar el access token
- Al hacer logout, el refresh token se invalida en BD

### Autorización: RBAC (Role-Based Access Control)

7 roles fijos: SUPER_ADMIN, ADMIN, DIRECTOR, PROFESOR_JEFE, PROFESOR, ESTUDIANTE, APODERADO.

Permisos se aplican a nivel de:

1. **Endpoint** con `@Roles()` decorator
2. **Recurso** con guards de ownership (ej: un apoderado solo ve a sus hijos)
3. **Campo** filtrado en el service (ej: estudiante no ve la información de contacto del docente)

### Validación de input

Todo input se valida en dos capas:

1. **Frontend**: Zod en formularios
2. **Backend**: class-validator en DTOs

Nunca confiamos en el frontend. La validación del backend es la única que importa para seguridad.

### Sanitización

- SQL injection: prevenido por Prisma (usa prepared statements)
- XSS: prevenido por React (escapado automático)
- Para casos donde se necesita HTML del usuario, usar `dompurify`

### Secretos y configuración

- Nunca commitear `.env` con secretos reales
- Solo `.env.example` con placeholders
- Producción carga secretos desde variables de entorno

## Patrones de auditoría

Toda operación importante queda registrada en `audit_logs`:

```typescript
{
  entityType: 'Course',
  entityId: 'uuid',
  action: 'UPDATE',
  changes: { name: { old: 'A', new: 'B' } },
  userId: 'uuid',
  userRole: 'ADMIN',
  ipAddress: '...',
  userAgent: '...',
  createdAt: '...'
}
```

Esto se hace automáticamente con un `AuditInterceptor` global. Los desarrolladores no tienen que escribir código de auditoría manualmente.

## Patrones de manejo de errores

### Backend

- Errores conocidos: throw de excepciones HTTP de NestJS (`BadRequestException`, `NotFoundException`, etc.)
- Errores inesperados: capturados por `HttpExceptionFilter` global y retornados como 500
- Todos los errores se loggean

### Frontend

- Errores de red: TanStack Query los maneja
- Errores de validación: react-hook-form + Zod los muestra inline
- Errores inesperados: Error Boundary los captura y muestra fallback

## Performance

### Backend

- **Cache con Redis** para queries costosas (dashboards, agregaciones)
- **Colas con Bull** para tareas pesadas (PDF, emails masivos)
- **Paginación obligatoria** en listados
- **Índices en BD** para columnas usadas en `where` o `orderBy` frecuentemente

### Frontend

- **Server Components** por defecto para reducir JS al cliente
- **Lazy loading** de componentes pesados con `dynamic()`
- **Imágenes** con `next/image` (optimización automática)
- **Bundle analysis** periódico para detectar imports innecesarios

## Testing

### Backend

- **Unit tests**: services con mocks de Prisma
- **E2E tests**: endpoints contra una BD de test
- Coverage objetivo: 70%+ en services, 50%+ overall

### Frontend

- **Component tests** con Vitest + Testing Library
- **E2E tests** con Playwright para flujos críticos (login, crear nota, etc.)

## Decisiones que NO tomamos (y por qué)

- **No usamos GraphQL**: REST es suficiente para nuestro caso. GraphQL agrega complejidad sin beneficio claro.
- **No usamos microservicios**: una sola API monolítica funciona para 6.000 usuarios concurrentes. Si crece, se escala vertical u horizontalmente con load balancer.
- **No usamos NoSQL**: nuestros datos son relacionales por naturaleza.
- **No usamos un CSS-in-JS**: Tailwind cubre todas las necesidades sin overhead de runtime.
- **No usamos Redux**: Zustand + TanStack Query cubren los casos. Redux es overkill.
