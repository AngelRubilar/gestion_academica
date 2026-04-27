# Coding Style — Convenciones de código

Reglas de estilo y convenciones para escribir código consistente en el proyecto. Si tu código no sigue estas reglas, el reviewer te lo va a pedir.

Para flujo de trabajo lee [CONTRIBUTING.md](./CONTRIBUTING.md). Para arquitectura lee [ARCHITECTURE.md](./ARCHITECTURE.md).

## Naming

### Variables y funciones — `camelCase`

```typescript
const studentCount = 30;
const isActive = true;

function calculateAverage(grades: number[]) { ... }
async function fetchStudentById(id: string) { ... }
```

### Clases, tipos, interfaces y enums — `PascalCase`

```typescript
class StudentsService { ... }
interface Course { ... }
type GradeValue = number;
enum Role { ADMIN, PROFESOR }
```

### Archivos

- **TypeScript/JavaScript**: `kebab-case.ts` (ej: `students-service.ts`, `grade-calculator.ts`)
- **Componentes React**: `PascalCase.tsx` (ej: `StudentsTable.tsx`, `CourseCard.tsx`)
- **Tests**: mismo nombre + `.spec.ts` o `.test.ts` (ej: `students-service.spec.ts`)
- **DTOs**: `kebab-case.dto.ts` (ej: `create-student.dto.ts`)

### Carpetas — `kebab-case` plural cuando aplica

```
modules/students/
hooks/use-current-user.ts
lib/api-client.ts
```

### Constantes globales — `UPPER_SNAKE_CASE`

```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const DEFAULT_PAGE_SIZE = 20;

export const ROLES = { ... } as const;
```

### Booleanos — prefijos `is`, `has`, `can`, `should`

```typescript
const isActive = true;
const hasPermission = checkPermission();
const canEdit = user.role === 'ADMIN';
const shouldNotify = config.notifications.enabled;
```

### Funciones — verbos en infinitivo

```typescript
function getStudentById(id: string) { ... }
function createCourse(data: CreateCourseDto) { ... }
function calculateFinalGrade(grades: Grade[]) { ... }
function isValidEmail(email: string): boolean { ... }
```

## Imports

### Orden

```typescript
// 1. Externos (node_modules)
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

// 2. Internos del workspace
import { ROLES } from '@gestion-academica/shared';

// 3. Relativos
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
```

ESLint y Prettier deberían ordenar esto automáticamente. Si no, configura tu IDE para hacerlo en save.

### Type-only imports

Si un import se usa solo como tipo, marcarlo:

```typescript
import type { User } from '@prisma/client';
```

### No usar default exports en código de aplicación

```typescript
// ❌ MAL
export default function StudentsTable() { ... }

// ✅ BIEN
export function StudentsTable() { ... }
```

Excepción: páginas de Next.js (`app/cursos/page.tsx`) requieren default export por convención del framework.

## Comentarios

**Regla general: no escribas comentarios.** El código bien nombrado se explica solo.

Cuándo SÍ escribir comentarios:

- **Cuando el código resuelve un caso no obvio**:

  ```typescript
  // El RUT chileno usa módulo 11 con algoritmo específico
  function validateRut(rut: string) { ... }
  ```

- **Cuando hay una decisión de negocio que el código no expresa**:

  ```typescript
  // Las notas se redondean hacia arriba en el último decimal
  // por requerimiento del Ministerio de Educación
  const finalGrade = Math.ceil(rawGrade * 10) / 10;
  ```

- **Cuando hay un workaround intencional**:
  ```typescript
  // Workaround: Prisma 7 no soporta orderBy compuesto en relaciones
  // Eliminar cuando se actualice la versión
  ```

Cuándo NO escribir comentarios:

- ❌ Para describir lo que el código hace (eso lo dice el código)
- ❌ Para marcar quién hizo qué (eso lo dice git blame)
- ❌ Para mencionar issues o PRs (van en el commit, no en el código)
- ❌ Como "TODO" sin issue asociado

```typescript
// ❌ MAL
// Recorre los estudiantes y filtra los activos
const activeStudents = students.filter((s) => s.isActive);

// ✅ BIEN (sin comentario)
const activeStudents = students.filter((s) => s.isActive);
```

## TypeScript

### Tipado estricto

`strict: true` está activado. No usar `any` salvo casos extremos. Usar `unknown` si realmente no se sabe el tipo.

```typescript
// ❌ MAL
function process(data: any) { ... }

// ✅ BIEN
function process(data: unknown) {
  if (typeof data === 'string') { ... }
}
```

### Inferencia vs anotación explícita

Dejar que TypeScript infiera cuando sea obvio. Anotar cuando aporte claridad.

```typescript
// ✅ Obvio, no necesita anotación
const count = 0;
const name = 'Juan';

// ✅ Anotación explícita en parámetros y retornos públicos
function calculate(a: number, b: number): number {
  return a + b;
}
```

### Enums vs union types

Preferir union types o `as const` objects. Los enums de TypeScript tienen problemas con tree-shaking.

```typescript
// ❌ Evitar
enum Status {
  Active,
  Inactive,
}

// ✅ Preferir
const STATUS = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' } as const;
type Status = (typeof STATUS)[keyof typeof STATUS];
```

Excepción: los enums de Prisma se importan tal cual del cliente generado.

### Async/await siempre

```typescript
// ❌ MAL
function fetchUser(id: string) {
  return api.get(`/users/${id}`).then((res) => res.data);
}

// ✅ BIEN
async function fetchUser(id: string) {
  const res = await api.get(`/users/${id}`);
  return res.data;
}
```

## Estructura de archivos

### Backend — un módulo por dominio

```
modules/students/
├── students.module.ts
├── students.controller.ts
├── students.service.ts
├── dto/
│   ├── create-student.dto.ts
│   └── update-student.dto.ts
├── students.controller.spec.ts
└── students.service.spec.ts
```

### Frontend — agrupar por dominio dentro de components

```
components/
├── ui/                       # Primitivos (shadcn/ui)
└── domain/
    ├── students/
    │   ├── students-table.tsx
    │   ├── student-form.tsx
    │   └── student-detail.tsx
    └── courses/
        ├── courses-grid.tsx
        └── course-form.tsx
```

### Tamaño máximo de archivo

- **Componentes React**: 200 líneas. Si crece más, dividir.
- **Services**: 300 líneas. Si crece más, considerar separar el dominio.
- **DTOs**: 50 líneas. Si crece más, probablemente representa varias entidades.

## Manejo de errores

### Backend

Lanzar excepciones de NestJS para errores conocidos:

```typescript
import { BadRequestException, NotFoundException } from '@nestjs/common';

if (!student) {
  throw new NotFoundException('Estudiante no encontrado');
}

if (existingEmail) {
  throw new BadRequestException('Email ya registrado');
}
```

Mensajes de error en español (es lo que ve el usuario final).

### Frontend

Manejar errores en el cliente API una sola vez:

```typescript
// lib/api-client.ts
export const apiClient = axios.create({ ... });

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Refresh token o redirigir a login
    }
    if (error.response?.status === 403) {
      toast.error('No tienes permiso para esta acción');
    }
    return Promise.reject(error);
  }
);
```

En componentes, usar el manejo de errores de TanStack Query:

```tsx
const { data, error, isLoading } = useQuery({ ... });

if (error) return <ErrorMessage error={error} />;
if (isLoading) return <Spinner />;
return <Data data={data} />;
```

## Logging

### Backend

Usar el logger de NestJS, no `console.log`:

```typescript
import { Logger } from '@nestjs/common';

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  async create(data: CreateStudentDto) {
    this.logger.log(`Creando estudiante: ${data.email}`);
    // ...
  }
}
```

Niveles de log:

- `log`: información general
- `warn`: situaciones inesperadas pero recuperables
- `error`: errores que requieren atención
- `debug`: solo en desarrollo, no en producción

### Frontend

`console.log` solo durante desarrollo. Antes de mergear, removerlos.

Para errores reales, usar un servicio de monitoreo (Sentry, similar) en el futuro. Por ahora `console.error`.

## Convenciones Prisma

### Modelos en PascalCase singular

```prisma
model Student { ... }       // ✅
model Course { ... }        // ✅
model students { ... }      // ❌
model Courses { ... }       // ❌
```

### Tablas en snake_case plural

```prisma
model Student {
  // ...
  @@map("students")
}
```

### Campos en camelCase

```prisma
model Student {
  id          String   @id @default(uuid())
  firstName   String
  lastName    String
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
}
```

### Foreign keys con sufijo `Id`

```prisma
teacherId   String?
courseId    String
```

### Relaciones siempre nombradas explícitamente

```prisma
model Course {
  teacherId   String?
  teacher     Teacher? @relation(fields: [teacherId], references: [id])
}
```

### Soft delete con `isActive`

```prisma
isActive Boolean @default(true)
```

No usar `deletedAt` salvo que se necesite saber **cuándo** se eliminó.

### Audit fields cuando aplique

```prisma
createdById String?
updatedById String?
createdAt   DateTime @default(now())
updatedAt   DateTime @updatedAt
```

## Convenciones de tests

### Naming

```
students.service.spec.ts       # Unit tests
students.controller.spec.ts    # Controller tests
students.e2e-spec.ts          # End-to-end tests
```

### Estructura: AAA (Arrange, Act, Assert)

```typescript
describe('StudentsService', () => {
  describe('create', () => {
    it('debe crear un estudiante con los datos correctos', async () => {
      // Arrange
      const dto = { firstName: 'Juan', lastName: 'Pérez', email: 'juan@example.com' };
      const expectedStudent = { id: '123', ...dto };

      // Act
      const result = await service.create(dto);

      // Assert
      expect(result).toEqual(expectedStudent);
    });

    it('debe lanzar BadRequestException si el email ya existe', async () => {
      // ...
    });
  });
});
```

### Descripciones en español

Las descripciones de los tests son documentación. Que se lean como una especificación.

```typescript
// ❌ MAL
it('test 1', () => { ... });
it('should work', () => { ... });

// ✅ BIEN
it('debe crear un estudiante con los datos correctos', () => { ... });
it('debe lanzar error si el email ya existe', () => { ... });
```

### Qué testear

- ✅ Lógica de negocio (services)
- ✅ Validaciones complejas
- ✅ Casos límite (edge cases)
- ✅ Flujos críticos end-to-end (login, crear nota)

### Qué NO testear

- ❌ Que Prisma funcione (es responsabilidad de Prisma)
- ❌ Que NestJS funcione (es responsabilidad del framework)
- ❌ Getters/setters triviales
- ❌ Tipos (eso lo hace TypeScript)

### Mocks

Usar mocks para dependencias externas (BD, APIs, servicios). Pero solo lo necesario.

```typescript
const mockPrisma = {
  student: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
};
```

## Formato

Prettier lo maneja automáticamente. Configuración en `.prettierrc`:

- Tabs: 2 espacios
- Single quotes
- Trailing commas (all)
- Semi: sí
- Print width: 100

Si tu IDE no lo aplica al guardar, configúralo. No commitees código sin formatear.

## Cosas que NO hacemos

### ❌ Magic numbers

```typescript
// ❌ MAL
if (grades.length > 12) { ... }

// ✅ BIEN
const MAX_GRADES_PER_PERIOD = 12;
if (grades.length > MAX_GRADES_PER_PERIOD) { ... }
```

### ❌ Strings sueltos para valores fijos

```typescript
// ❌ MAL
if (user.role === 'ADMIN') { ... }

// ✅ BIEN
import { ROLES } from '@gestion-academica/shared';
if (user.role === ROLES.ADMIN) { ... }
```

### ❌ Booleanos en parámetros (flag arguments)

```typescript
// ❌ MAL — al leer la llamada no se entiende qué hace cada boolean
sendNotification(user, true, false, true);

// ✅ BIEN — opciones nombradas
sendNotification(user, { byEmail: true, push: false, sms: true });
```

### ❌ Funciones gigantes

Si una función supera 50 líneas, probablemente hace varias cosas. Divídela.

### ❌ Anidación profunda

Si tienes más de 3 niveles de anidación (`if` dentro de `if` dentro de `for`), refactoriza con early returns o extrae funciones.

```typescript
// ❌ MAL
function process(data) {
  if (data) {
    if (data.user) {
      if (data.user.isActive) {
        // hacer algo
      }
    }
  }
}

// ✅ BIEN
function process(data) {
  if (!data) return;
  if (!data.user) return;
  if (!data.user.isActive) return;

  // hacer algo
}
```

### ❌ Comentarios mentirosos

Si tu código cambia, actualiza el comentario o bórralo. Un comentario que describe algo que ya no es cierto es peor que no tener comentario.

### ❌ TODO sin issue asociado

```typescript
// ❌ MAL
// TODO: hacer esto mejor

// ✅ BIEN — si es importante, crea un issue
// (sin comentario en el código)
```

### ❌ Código comentado

Si está comentado, bórralo. Git lo tiene en el historial si lo necesitas.
