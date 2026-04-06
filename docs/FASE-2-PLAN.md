# Fase 2 — Asistencia, Notificaciones y Dashboards

## Objetivo

Agregar el registro de asistencia, sistema de comunicaciones/notificaciones y dashboards de seguimiento académico para todos los roles.

## Prerrequisito

Fase 1 completada.

---

## Bloque 4 — Asistencia

| Issue | Título                                   | Tipo     | Dependencia | Paralelo |
| ----- | ---------------------------------------- | -------- | ----------- | -------- |
| #36   | Backend: Registro de asistencia diaria   | backend  | Fase 1      | —        |
| #37   | Backend: Cálculo de porcentaje y alertas | backend  | #36         | —        |
| #38   | Frontend: Registro de asistencia         | frontend | #36, #37    | Con #39  |
| #39   | Frontend: Panel de alertas de asistencia | frontend | #37         | Con #38  |

**Asignación sugerida:**

- Dev A: #36 → #37 (secuencial)
- Dev B: puede avanzar con Bloque 5 en paralelo
- Frontend (#38, #39) se reparten al terminar backend

---

## Bloque 5 — Notificaciones y Comunicaciones

| Issue | Título                                       | Tipo     | Dependencia | Paralelo |
| ----- | -------------------------------------------- | -------- | ----------- | -------- |
| #40   | Backend: Notificaciones internas             | backend  | Fase 1      | —        |
| #41   | Backend: Push notifications y email          | backend  | #40         | Con #42  |
| #42   | Backend: WebSockets tiempo real              | backend  | #40         | Con #41  |
| #43   | Frontend: Centro de notificaciones           | frontend | #40, #42    | Con #44  |
| #44   | Frontend: Formulario de envío de comunicados | frontend | #40, #41    | Con #43  |

**Asignación sugerida:**

- Dev A: #41 → #44
- Dev B: #42 → #43
- Issue #40 primero (cualquier dev)

---

## Bloque 6 — Dashboards de Seguimiento Académico

| Issue | Título                               | Tipo     | Dependencia | Paralelo          |
| ----- | ------------------------------------ | -------- | ----------- | ----------------- |
| #45   | Backend: Endpoints de indicadores    | backend  | Fase 1, #37 | —                 |
| #46   | Frontend: Dashboard de dirección     | frontend | #45         | Con #47, #48, #49 |
| #47   | Frontend: Dashboard de profesor jefe | frontend | #45         | Con #46, #48, #49 |
| #48   | Frontend: Dashboard de estudiante    | frontend | #45         | Con #46, #47, #49 |
| #49   | Frontend: Dashboard de apoderado     | frontend | #45         | Con #46, #47, #48 |

**Asignación sugerida:**

- Issue #45 primero (cualquier dev)
- Los 4 dashboards frontend son independientes — repartir 2 por dev

---

## Diagrama de Dependencias Fase 2

```
Fase 1 completada
    │
    ├── #36 → #37 → #38, #39         (Asistencia)
    │
    ├── #40 → #41 → #44              (Notificaciones)
    │    └──→ #42 → #43
    │
    └── #45 → #46, #47, #48, #49     (Dashboards)
```

## Resumen

- **14 issues** (36-49)
- **Bloques 4, 5 y 6** pueden trabajarse en paralelo entre los dos devs
- Los dashboards frontend (#46-49) son todos independientes entre sí
