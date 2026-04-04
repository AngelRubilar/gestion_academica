# Fase 3 — App Móvil, Agenda, Analítica y Portales

## Objetivo
Completar la plataforma con la aplicación móvil, sistema de agenda/reuniones, reportes avanzados y portales dedicados para estudiantes y apoderados.

## Prerrequisito
Fase 1 y Fase 2 completadas.

---

## Bloque 7 — Aplicación Móvil (React Native + Expo)

| Issue | Título | Tipo | Dependencia | Paralelo |
|-------|--------|------|-------------|----------|
| #50 | Setup React Native con Expo | setup | Fase 1 | — |
| #51 | Mobile: Pantalla de login | frontend | #50 | — |
| #52 | Mobile: Pantalla de notas | frontend | #51 | Con #53, #54, #55, #56 |
| #53 | Mobile: Pantalla de asistencia | frontend | #51 | Con #52, #54, #55, #56 |
| #54 | Mobile: Pantalla de materiales | frontend | #51 | Con #52, #53, #55, #56 |
| #55 | Mobile: Notificaciones push | frontend | #51 | Con #52, #53, #54, #56 |
| #56 | Mobile: Calendario de evaluaciones | frontend | #51 | Con #52, #53, #54, #55 |

**Asignación sugerida:**
- Issues #50 y #51 secuenciales (cualquier dev)
- Issues #52-56 son independientes — repartir entre los dos devs

---

## Bloque 8 — Agenda y Reuniones

| Issue | Título | Tipo | Dependencia | Paralelo |
|-------|--------|------|-------------|----------|
| #57 | Backend: Disponibilidad de docentes | backend | Fase 1 | — |
| #58 | Backend: Solicitud y gestión de reuniones | backend | #57, #40 | — |
| #59 | Frontend: Página de disponibilidad docente | frontend | #57 | Con #60 |
| #60 | Frontend: Solicitud y gestión de reuniones | frontend | #58 | Con #59 |

**Asignación sugerida:**
- Dev A: #57 → #59
- Dev B: #58 → #60

---

## Bloque 9 — Reportes y Analítica Avanzada

| Issue | Título | Tipo | Dependencia | Paralelo |
|-------|--------|------|-------------|----------|
| #61 | Backend: Generación de reportes PDF | backend | Fase 1 y 2 | Con #62 |
| #62 | Backend: Exportación de datos (Excel/CSV) | backend | Fase 1 y 2 | Con #61 |
| #63 | Frontend: Página de reportes | frontend | #61, #62 | — |

**Asignación sugerida:**
- Dev A: #61
- Dev B: #62
- #63 al terminar ambos (cualquier dev)

---

## Bloque 10 — Portales Dedicados

| Issue | Título | Tipo | Dependencia | Paralelo |
|-------|--------|------|-------------|----------|
| #64 | Frontend: Portal dedicado de estudiantes | frontend | Fase 1 y 2 | Con #65 |
| #65 | Frontend: Portal dedicado de apoderados | frontend | Fase 1 y 2 | Con #64 |

**Asignación sugerida:**
- Dev A: #64
- Dev B: #65
- Completamente independientes

---

## Diagrama de Dependencias Fase 3

```
Fase 1 + 2 completadas
    │
    ├── #50 → #51 → #52, #53, #54, #55, #56    (Mobile)
    │
    ├── #57 → #58 → #59, #60                    (Agenda)
    │
    ├── #61 ──┐
    │   #62 ──┴→ #63                             (Reportes)
    │
    └── #64, #65                                 (Portales)
```

## Resumen
- **16 issues** (50-65)
- **Bloques 7, 8, 9 y 10** pueden trabajarse en paralelo entre los dos devs
- Las pantallas móviles (#52-56) son todas independientes entre sí
- Los portales (#64, #65) son completamente independientes

---

## Resumen Global del Proyecto

| Fase | Issues | Bloques | Descripción |
|------|--------|---------|-------------|
| Fase 1 | #1 - #35 | 0-3 | Fundación + Core Académico |
| Fase 2 | #36 - #49 | 4-6 | Asistencia, Notificaciones, Dashboards |
| Fase 3 | #50 - #65 | 7-10 | Mobile, Agenda, Reportes, Portales |
| **Total** | **65 issues** | **11 bloques** | — |
