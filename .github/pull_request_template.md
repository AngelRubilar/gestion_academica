## Descripción

<!-- Explica qué se hizo y por qué. No describas el código, describe el problema que resuelve. -->

## Cambios realizados

<!-- Lista los cambios principales agrupados por área -->

### Archivos creados

<!-- - `ruta/archivo.ts` — descripción breve -->

### Archivos modificados

<!-- - `ruta/archivo.ts` — qué se cambió y por qué -->

### Archivos eliminados

<!-- - `ruta/archivo.ts` — por qué se eliminó -->

## Cómo probar

<!-- Pasos exactos para que el reviewer pueda verificar los cambios -->

1.
2.
3.

## Issues relacionados

<!-- Closes #XX -->

## Screenshots / Evidencia

<!-- Si aplica, agrega capturas de pantalla o logs que demuestren que funciona -->

## Notas para el reviewer

<!-- Algo que el reviewer debería saber antes de revisar -->

---

## Checklist del autor

Antes de pedir review, marca todo:

- [ ] El código cumple el objetivo del issue (todos los criterios de aceptación)
- [ ] Sigue las convenciones de [CODING_STYLE.md](../CODING_STYLE.md)
- [ ] Sigue los patrones de [ARCHITECTURE.md](../ARCHITECTURE.md)
- [ ] Lint, format y typecheck pasan localmente
- [ ] Tests pasan localmente
- [ ] Probé manualmente la funcionalidad (no basta con los tests)
- [ ] Cada commit no supera 300 líneas (excepto auto-generados)
- [ ] No incluyo archivos sensibles (.env, credenciales)
- [ ] Llené esta plantilla completa, sin secciones vacías

---

## Checklist del reviewer

El reviewer marca esto durante el review:

### Funcional

- [ ] La PR cumple el objetivo del issue (cierra los criterios de aceptación)
- [ ] La funcionalidad fue probada manualmente
- [ ] No rompe funcionalidades existentes

### Código

- [ ] Sigue convenciones de naming (camelCase, PascalCase, kebab-case según corresponda)
- [ ] Sin código muerto, console.logs sin justificar, comentarios TODO sin issue
- [ ] Sin magic numbers ni strings sueltos
- [ ] Funciones pequeñas y enfocadas
- [ ] Anidación máxima de 3 niveles
- [ ] Imports ordenados (externos → internos → relativos)

### Arquitectura

- [ ] Usa los patrones de [ARCHITECTURE.md](../ARCHITECTURE.md)
- [ ] Backend: respeta capas Controller → Service → Prisma
- [ ] Frontend: usa Server Components donde aplica, hooks para lógica reutilizable
- [ ] No introduce dependencias innecesarias
- [ ] No hay duplicación que debería ser DRY

### Seguridad

- [ ] No expone secretos ni credenciales
- [ ] Valida input del usuario (Zod en frontend, class-validator en backend)
- [ ] Aplica permisos por rol con `@Roles()` o guards
- [ ] No confía en validaciones del frontend para seguridad
- [ ] Sanitiza datos cuando se renderiza HTML del usuario

### Base de datos

- [ ] Migraciones no son breaking (no eliminan columnas en uso, no cambian tipos sin migrar datos)
- [ ] Soft delete vía `isActive`, no DELETE físico
- [ ] Audit fields (`createdById`, `updatedById`) si aplica
- [ ] Sin queries N+1 (usa `include` o `select` apropiado)
- [ ] Índices en columnas usadas en `where` o `orderBy` frecuentes

### Performance

- [ ] Listados con paginación
- [ ] Sin queries innecesarias en loops
- [ ] Cache (Redis) en endpoints costosos cuando aplica
- [ ] Frontend: lazy loading donde corresponde

### Tests

- [ ] Tests cubren los casos críticos del issue
- [ ] Tests de error y casos límite (no solo el happy path)
- [ ] Descripciones de tests en español, claras
- [ ] Mocks razonables (no mockean toda la implementación)

### Documentación

- [ ] Si introduce un patrón nuevo, está documentado
- [ ] README actualizado si cambia el flujo de instalación o uso
- [ ] Schema de Prisma comentado donde el modelo es complejo
