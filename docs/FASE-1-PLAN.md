# Fase 1 — Fundación + Core Académico

## Objetivo
Construir la base completa de la plataforma: infraestructura, autenticación, gestión de entidades académicas, materiales, evaluaciones y notas.

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Lenguaje | TypeScript (end-to-end) |
| Frontend Web | Next.js (App Router) + Tailwind CSS + shadcn/ui |
| Backend API | NestJS (Node.js) |
| Base de datos | PostgreSQL + Prisma ORM |
| Cache/Colas | Redis + Bull |
| Almacenamiento | MinIO (S3-compatible) |
| Monorepo | Turborepo |
| Containerización | Docker + Docker Compose |
| CI/CD | GitHub Actions |

## Estructura del Monorepo

```
gestion_academica/
├── apps/
│   ├── api/          → NestJS (backend API REST)
│   ├── web/          → Next.js (frontend web)
│   └── mobile/       → React Native con Expo (Fase 3)
├── packages/
│   ├── shared/       → Tipos, validaciones (Zod), constantes
│   └── ui/           → Componentes UI compartidos
├── deploy/
│   ├── docker-compose.yml
│   ├── .env.example
│   └── nginx/
├── docs/
└── turbo.json
```

## Roles del Sistema

| Rol | Descripción |
|-----|------------|
| SUPER_ADMIN | Equipo de desarrollo — configuración técnica, soporte, mantenimiento |
| ADMIN | Personal del colegio — gestión de usuarios, cursos, datos académicos |
| DIRECTOR | Dashboards, reportes, indicadores globales |
| PROFESOR_JEFE | Seguimiento de curso + funciones de profesor |
| PROFESOR | Notas, asistencia, material, evaluaciones |
| ESTUDIANTE | Consulta de información propia |
| APODERADO | Consulta de información de hijos, comunicados, reuniones |

## Plan de Trabajo — Bloques e Issues

### Cómo leer este plan

- Los issues están organizados en **bloques secuenciales** (0 → 1 → 2 → 3)
- Dentro de cada bloque, los issues marcados como paralelos pueden trabajarse simultáneamente por Dev A y Dev B
- Cada issue tiene sus **dependencias** listadas — no empezar un issue hasta que sus dependencias estén completadas
- Los issues de **frontend** dependen siempre de su contraparte de **backend**

---

### Bloque 0 — Fundación (setup inicial)

> Se hace primero. Todo lo demás depende de esto.

| Issue | Título | Tipo | Dependencia | Paralelo |
|-------|--------|------|-------------|----------|
| #1 | Scaffolding monorepo con Turborepo | setup | — | — |
| #2 | Setup Docker + Docker Compose | setup | #1 | — |
| #3 | Schema Prisma - Modelos de Fase 1 | backend | #2 | — |
| #4 | Config base NestJS | backend | #3 | Con #5 |
| #5 | Config base Next.js | frontend | #3 | Con #4 |

**Asignación sugerida:** Issues 1-3 secuenciales (cualquier dev). Issues 4 y 5 en paralelo (uno por dev).

---

### Bloque 1 — Autenticación

> Segundo bloque. La mayoría de módulos dependen de auth.

| Issue | Título | Tipo | Dependencia | Paralelo |
|-------|--------|------|-------------|----------|
| #6 | Backend: Login y registro (JWT) | backend | #4 | — |
| #7 | Backend: Recuperación de contraseña | backend | #6 | Con #8 |
| #8 | Backend: Guards de roles y permisos | backend | #6 | Con #7 |
| #9 | Frontend: Login y registro | frontend | #5, #6 | Con #10 |
| #10 | Frontend: Recuperación de contraseña | frontend | #5, #7 | Con #9 |
| #11 | Frontend: Auth context y protección de rutas | frontend | #9, #8 | — |

**Asignación sugerida:**
- Dev A: #7 → #10
- Dev B: #8 → #9 → #11
- Issue #6 primero (cualquier dev)

---

### Bloque 2 — Entidades Base (paralelo entre devs)

> Se puede empezar una vez que auth esté listo (#8 y #11 completados).

#### Dev A — Usuarios y personas

| Issue | Título | Tipo | Dependencia |
|-------|--------|------|-------------|
| #12 | Backend: CRUD Usuarios | backend | #8 |
| #13 | Backend: CRUD Profesores | backend | #12 |
| #14 | Backend: CRUD Alumnos | backend | #12 |
| #15 | Backend: CRUD Apoderados | backend | #12 |
| #16 | Backend: Vinculación apoderado-alumno | backend | #14, #15 |
| #21 | Frontend: Gestión de usuarios | frontend | #11, #12 |
| #22 | Frontend: Gestión de profesores | frontend | #11, #13 |
| #23 | Frontend: Gestión de alumnos | frontend | #11, #14 |
| #24 | Frontend: Gestión de apoderados | frontend | #11, #15 |
| #25 | Frontend: Vinculación apoderado-alumno | frontend | #11, #16 |

#### Dev B — Cursos y estructura académica

| Issue | Título | Tipo | Dependencia |
|-------|--------|------|-------------|
| #17 | Backend: CRUD Cursos | backend | #8 |
| #18 | Backend: CRUD Asignaturas | backend | #8 |
| #19 | Backend: Vinculación profesor-asignatura-curso | backend | #13, #17, #18 |
| #20 | Backend: Vinculación alumno-curso | backend | #14, #17 |
| #26 | Frontend: Gestión de cursos | frontend | #11, #17 |
| #27 | Frontend: Gestión de asignaturas | frontend | #11, #18 |
| #28 | Frontend: Vinculación profesor-asignatura-curso | frontend | #11, #19 |
| #29 | Frontend: Vinculación alumno-curso | frontend | #11, #20 |

> **Nota:** Issues #19 y #20 de Dev B dependen de issues de Dev A (#13, #14). Dev B puede empezar con #17 y #18 mientras Dev A avanza con #12-#15.

---

### Bloque 3 — Módulos Funcionales (paralelo entre devs)

> Requiere que las entidades base estén creadas.

#### Dev A — Archivos/Material

| Issue | Título | Tipo | Dependencia |
|-------|--------|------|-------------|
| #30 | Backend: Subida y descarga de archivos | backend | #17, #18 |
| #33 | Frontend: Gestión de materiales | frontend | #11, #30 |

#### Dev B — Evaluaciones y Notas

| Issue | Título | Tipo | Dependencia |
|-------|--------|------|-------------|
| #31 | Backend: CRUD Evaluaciones | backend | #17, #18 |
| #32 | Backend: Registro de notas y promedios | backend | #31, #14 |
| #34 | Frontend: Gestión de evaluaciones | frontend | #11, #31 |
| #35 | Frontend: Gestión de notas | frontend | #11, #32 |

---

## Diagrama de Dependencias

```
#1 → #2 → #3 → #4 (backend) ─→ #6 → #7 → #10
                  └→ #5 (frontend)    └→ #8 → #9 → #11
                                                     │
                  ┌──────────────────────────────────┘
                  │
         Dev A    │    Dev B
         ─────   │    ─────
         #12     │    #17, #18
         ├#13    │    ├#19 (necesita #13)
         ├#14    │    └#20 (necesita #14)
         ├#15    │
         └#16    │
                 │
         #21-25  │    #26-29  (frontend, paralelo)
                 │
         #30→#33 │    #31→#32→#34,#35 (bloque 3)
```

## Modelo de Despliegue

Cada colegio = una instancia independiente con su propio stack Docker (API, Web, PostgreSQL, Redis, MinIO, Nginx). Para nuevo colegio: copiar docker-compose + ajustar variables de entorno.

## Fases Futuras

- **Fase 2:** Asistencia, Notificaciones, Dashboards de seguimiento
- **Fase 3:** App móvil (React Native/Expo), Agenda/Reuniones, Analítica avanzada, Portales dedicados
