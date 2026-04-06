# Plataforma Educacional Escolar — Documento de Diseño

## Resumen

Plataforma web y móvil para gestión académica integral de establecimientos escolares. Soporta ~3.000 alumnos y ~6.000 usuarios concurrentes por instancia. Modelo de despliegue: una instancia independiente por colegio (no multi-tenant).

## Stack Tecnológico

| Capa                       | Tecnología                                      |
| -------------------------- | ----------------------------------------------- |
| Lenguaje                   | TypeScript (end-to-end)                         |
| Frontend Web               | Next.js (App Router) + Tailwind CSS + shadcn/ui |
| Backend API                | NestJS (Node.js)                                |
| Base de datos              | PostgreSQL + Prisma ORM                         |
| App Móvil                  | React Native con Expo                           |
| Cache/Colas                | Redis + Bull                                    |
| Almacenamiento de archivos | MinIO (S3-compatible, self-hosted)              |
| Notificaciones push        | Firebase Cloud Messaging                        |
| Monorepo                   | Turborepo                                       |
| Containerización           | Docker + Docker Compose                         |
| CI/CD                      | GitHub Actions                                  |
| Reverse Proxy              | Nginx + Let's Encrypt                           |

## Actores del Sistema

- **Super Admin** — Equipo de desarrollo/soporte. Configuración técnica de la instancia, soporte y mantenimiento
- **Administrador** — Personal del colegio. Gestión de usuarios, roles, cursos, datos académicos, configuración del sistema
- **Director** — Dashboards de rendimiento, reportes, indicadores globales
- **Profesor Jefe** — Seguimiento general del curso + todo lo del profesor
- **Profesor** — Registran notas, asistencia, suben material, crean evaluaciones
- **Estudiante** — Consultan notas, asistencia, materiales, evaluaciones
- **Apoderado** — Consultan información de sus hijos, reciben comunicados, solicitan reuniones

## Arquitectura

### Monorepo con Turborepo

```
plataforma-educacional/
├── apps/
│   ├── web/          → Next.js (frontend web)
│   ├── api/          → NestJS (backend API REST)
│   └── mobile/       → React Native con Expo
├── packages/
│   ├── shared/       → Tipos, validaciones (Zod), constantes, cliente API
│   └── ui/           → Componentes UI compartidos
├── deploy/
│   ├── docker-compose.base.yml
│   ├── .env.example
│   └── nginx/
└── turbo.json
```

### Comunicación entre capas

- Web y Mobile se comunican con el API vía REST
- Notificaciones en tiempo real vía WebSockets (Socket.io integrado en NestJS)
- Push notifications móviles vía Firebase Cloud Messaging

### Modelo de despliegue — Instancia por colegio

Cada colegio tiene su propio despliegue completo e independiente:

- Su propia instancia de API, Web, PostgreSQL y Redis
- Aislamiento total de datos entre colegios
- Desplegar un colegio nuevo = copiar docker-compose + ajustar variables de entorno

## Backend — NestJS

### Estructura de módulos

```
apps/api/src/
├── modules/
│   ├── auth/           → Login, JWT, refresh tokens, recuperación de contraseña
│   ├── users/          → CRUD usuarios, gestión de roles
│   ├── students/       → Gestión de alumnos
│   ├── guardians/      → Gestión de apoderados
│   ├── teachers/       → Gestión de docentes
│   ├── courses/        → Cursos y asignación de alumnos
│   ├── subjects/       → Asignaturas y vinculación con docentes
│   ├── files/          → Subida/descarga de material educativo
│   ├── evaluations/    → Creación y gestión de evaluaciones
│   ├── grades/         → Registro de notas, cálculo de promedios
│   ├── attendance/     → Registro de asistencia, cálculo de porcentajes
│   ├── notifications/  → Avisos, push, correos
│   ├── meetings/       → Agenda y reuniones
│   └── reports/        → Reportes y analítica
├── common/
│   ├── guards/         → RolesGuard, JwtGuard
│   ├── interceptors/   → Logging, transformación de respuestas
│   ├── filters/        → Manejo global de errores
│   └── decorators/     → @Roles, @CurrentUser
└── config/             → Variables de entorno, configuración por colegio
```

### Autenticación

- JWT con refresh tokens
- Guards por rol para proteger rutas
- Compatible con web y móvil

### Tareas pesadas

- Redis + Bull para colas de trabajo
- Generación de reportes PDF, envío masivo de correos/notificaciones

## Base de Datos — PostgreSQL + Prisma

### Entidades principales

- Usuario, Rol
- Alumno, Apoderado, Profesor
- Curso, Asignatura
- Evaluación, Nota
- Asistencia
- Material (archivo educativo)
- Notificación
- Reunión
- Tablas de relación: alumno-curso, profesor-asignatura-curso, apoderado-alumno

### Prisma ORM

- Schema declarativo con generación automática de tipos TypeScript
- Migraciones versionadas y reproducibles (clave para replicar BD en cada instancia)
- Consultas type-safe

## Frontend Web — Next.js

### Tecnologías

- Next.js con App Router
- Tailwind CSS + shadcn/ui para componentes
- TanStack Query (React Query) para manejo de datos del servidor
- Zustand para estado local de UI

### Estructura

```
apps/web/src/
├── app/
│   ├── (auth)/             → Login, recuperar contraseña
│   ├── (dashboard)/        → Layout principal post-login
│   │   ├── cursos/
│   │   ├── notas/
│   │   ├── asistencia/
│   │   ├── evaluaciones/
│   │   ├── materiales/
│   │   ├── reuniones/
│   │   ├── notificaciones/
│   │   └── reportes/
│   └── admin/              → Panel de administración
├── components/
│   ├── ui/                 → shadcn/ui
│   └── domain/             → Componentes específicos del negocio
├── hooks/
├── lib/
└── types/
```

### Vistas por rol

El dashboard adapta su contenido según el rol del usuario logueado. Un profesor ve sus cursos y registra notas, un apoderado solo ve la información de sus hijos, dirección ve indicadores globales.

## App Móvil — React Native con Expo

### Alcance

Principalmente consumo de información:

- Consulta de notas y asistencia
- Recepción de notificaciones push
- Descarga de materiales
- Vista de calendario/evaluaciones
- Comunicados del colegio

### Estructura

```
apps/mobile/src/
├── screens/
│   ├── auth/
│   ├── grades/
│   ├── attendance/
│   ├── materials/
│   ├── notifications/
│   └── calendar/
├── components/
├── hooks/
├── services/
└── navigation/
```

### Código compartido

Tipos, validaciones (Zod) y lógica de llamadas al API viven en `packages/shared` — tanto la web como la app móvil los consumen. Solo cambia la capa de UI.

## Infraestructura

### Docker por instancia

Cada colegio corre su propio stack containerizado:

- Nginx (reverse proxy + SSL con Let's Encrypt)
- API (NestJS)
- Web (Next.js en modo producción)
- PostgreSQL
- Redis
- MinIO (almacenamiento de archivos)

### CI/CD

- GitHub Actions: tests automáticos, build de imágenes Docker
- Backups automáticos de PostgreSQL con cron + pg_dump
- Health checks + alertas para monitoreo

### Almacenamiento de archivos

- MinIO (S3-compatible, self-hosted) en VPS
- Migración transparente a Cloudflare R2 o AWS S3 si crece la demanda (misma API)

## Módulos del Sistema

### Fase 1

1. Autenticación y gestión de usuarios
2. Gestión académica (cursos, asignaturas, vinculaciones)
3. Gestión de archivos por asignatura
4. Gestión de evaluaciones
5. Gestión de notas

### Fase 2

6. Gestión de asistencia
7. Notificaciones y comunicaciones
8. Seguimiento académico (dashboards)

### Fase 3

9. App móvil
10. Agenda y reuniones
11. Reportes y analítica avanzada
12. Portal de estudiantes
13. Portal de apoderados

## Integraciones externas

- Ministerio de Educación: pendiente investigar APIs/formatos disponibles. La arquitectura basada en API REST permite agregar integraciones sin afectar módulos existentes.

## Requerimientos No Funcionales

- **Rendimiento:** Soporte para 6.000+ usuarios concurrentes por instancia
- **Seguridad:** JWT, encriptación de datos sensibles, RBAC, protección de datos personales
- **Disponibilidad:** 99.5% uptime, backups automáticos
- **Escalabilidad:** Instancia independiente por colegio, containerización con Docker
- **Usabilidad:** Interfaz responsive, diseño intuitivo con shadcn/ui
