# Contributing — Workflow del equipo

Esta guía explica cómo trabajamos en el proyecto Gestión Académica. Antes de tu primer commit, léela completa.

Para entender la arquitectura del sistema, lee [ARCHITECTURE.md](./ARCHITECTURE.md). Para convenciones de código, lee [CODING_STYLE.md](./CODING_STYLE.md).

## Filosofía del proyecto

Tres principios guían todas nuestras decisiones técnicas:

### KISS — Keep It Simple, Stupid

La solución más simple que resuelve el problema gana. Evitamos la complejidad innecesaria.

- Si necesitas explicar tu código con un párrafo, probablemente está mal diseñado.
- Una función con 50 líneas y un `if` claro es mejor que una con 10 líneas y 4 niveles de abstracción.
- Si dudas entre dos implementaciones, elige la más fácil de leer.

### YAGNI — You Aren't Gonna Need It

No construimos lo que "tal vez vayamos a necesitar". Solo lo que necesitamos hoy.

- No agregamos campos a la BD "por si acaso"
- No creamos endpoints que nadie consume
- No abstraemos algo hasta que tengamos al menos 2-3 casos reales

### DRY — Don't Repeat Yourself

Pero con cuidado. La duplicación accidental se elimina; la duplicación coincidente se deja.

- Si ves el mismo código tres veces, refactoriza
- Si ves dos lugares "parecidos" pero diferentes, no los unifiques

## Cómo trabajar un issue

### 1. Asignarte el issue

Antes de empezar a codear, asígnate el issue desde GitHub. Esto evita que dos personas trabajen en lo mismo.

### 2. Verificar dependencias

Lee el campo "Dependencias" del issue. Si depende de otros issues que aún no están mergeados, no puedes empezar todavía. Pregunta en el equipo.

### 3. Actualizar main local

```bash
git checkout main
git pull origin main
```

### 4. Crear rama feature

Convención: `feature/<numero-issue>-<descripcion-corta>`

Ejemplos:

- `feature/12-crud-usuarios`
- `feature/30-upload-archivos`
- `feature/45-dashboard-direccion`

```bash
git checkout -b feature/12-crud-usuarios
```

### 5. Implementar

- Sigue las convenciones de [CODING_STYLE.md](./CODING_STYLE.md)
- Escribe tests cuando aplique
- Verifica localmente: `pnpm lint`, `pnpm format:check`, `pnpm test`

### 6. Probar manualmente

Antes de crear la PR, prueba la funcionalidad en local. No basta con que pasen los tests automáticos.

### 7. Crear PR

Usa la plantilla de PR (se carga automáticamente al crear PR en GitHub). Llénala completa, no dejes secciones vacías.

## Reglas de commits

### Tamaño máximo: 300 líneas

Cada commit debe tener máximo 300 líneas modificadas (excluyendo archivos auto-generados como `pnpm-lock.yaml` o migraciones de Prisma).

Si un cambio tiene más de 300 líneas, divídelo en commits lógicos:

```
feat(users): agregar modelo User al schema (50 líneas)
feat(users): crear endpoints CRUD básicos (180 líneas)
feat(users): agregar tests del módulo (120 líneas)
```

### Convención de mensaje

```
<tipo>(<scope>): <descripción corta en presente>

<descripción larga opcional>

Ref #<numero-issue>
```

Tipos válidos:

- **feat**: nueva funcionalidad
- **fix**: corrección de bug
- **chore**: cambios de configuración o tooling
- **docs**: solo documentación
- **style**: formato (sin cambios de lógica)
- **refactor**: refactor sin cambio de comportamiento
- **test**: agregar o modificar tests
- **perf**: mejora de rendimiento

Scopes comunes:

- `api`, `web`, `mobile`, `db`, `auth`, `ci`, `docker`, `shared`

Ejemplo correcto:

```
feat(api): agregar endpoint de login

Implementa POST /auth/login con JWT y refresh tokens.
Valida credenciales contra la BD usando bcrypt.

Ref #6
```

### Prohibido

- No incluir `Co-Authored-By: Claude` ni referencias a IA
- No usar `--no-verify` para saltarse hooks
- No commits con mensajes vagos: "fix", "wip", "asdasd"
- No mezclar cambios de distintos issues en un mismo commit

## Crear y revisar PRs

### Antes de crear la PR

- [ ] Tu rama está actualizada con main (`git pull origin main`)
- [ ] Lint y format pasan: `pnpm lint && pnpm format:check`
- [ ] Type check pasa: `pnpm exec tsc --noEmit`
- [ ] Tests pasan: `pnpm test`
- [ ] Probaste manualmente la funcionalidad
- [ ] Llenaste la plantilla de PR completa

### Asignar reviewer

Asigna al otro dev como reviewer. Si trabajan los dos en paralelo, asignen review cruzado.

### Cuándo se mergea una PR

Solo cuando se cumplen TODAS estas condiciones:

1. CI verde (todos los checks pasan)
2. Al menos 1 review aprobado
3. No hay conflictos con main
4. Todos los comentarios resueltos

### Quién mergea

Quien creó la PR es responsable de hacer el merge una vez aprobada. El reviewer no mergea.

### Estrategia de merge

Usar **Squash and Merge** cuando:

- La PR tiene varios commits triviales que no aportan al historial

Usar **Merge Commit** cuando:

- La PR tiene commits semánticamente importantes que vale la pena mantener separados

## Resolución de conflictos

Si tu rama tiene conflictos con main:

```bash
git checkout main
git pull origin main
git checkout feature/tu-rama
git rebase main
# Resolver conflictos en cada commit
git rebase --continue
git push --force-with-lease
```

**No usar `merge` para integrar main**, siempre `rebase`. Esto mantiene el historial limpio.

## Hotfixes (urgencias en producción)

Si hay un bug crítico en producción que no puede esperar al ciclo normal:

1. Crear issue con label `hotfix` y prioridad alta
2. Crear rama desde main: `hotfix/<descripcion>`
3. Implementar fix mínimo (solo lo necesario, sin refactors adicionales)
4. PR con review prioritario
5. Merge inmediato cuando esté aprobado
6. Tag de versión con incremento de patch (ej: `v1.0.1`)

## Code Review — Cómo dar feedback

### Tono

- Sé directo, pero no agresivo
- Comenta el código, no a la persona
- Usa preguntas en lugar de imperativos cuando dudes: "¿No sería más simple si...?" en vez de "Cámbialo a..."

### Niveles de feedback

Marca cada comentario con su nivel:

- **🔴 BLOCKER**: hay que cambiarlo antes de mergear
- **🟡 NIT**: cambio menor, opcional pero recomendado
- **🔵 PREGUNTA**: solo quiero entender, no necesariamente cambiar nada
- **💡 IDEA**: sugerencia para considerar, no para esta PR

### Qué buscar

Usa el checklist de la plantilla de PR como guía. Particularmente importante:

- ¿Cumple el objetivo del issue?
- ¿Hay tests para los casos críticos?
- ¿Se valida el input del usuario?
- ¿Los permisos por rol están aplicados?
- ¿Hay consultas N+1 a la BD?
- ¿Hay secretos expuestos?

## Recibir code review

- Asume buena fe del reviewer
- Si no estás de acuerdo, explica tu razón con argumentos técnicos
- Cuando hagas cambios, responde al comentario con una breve explicación
- No marques un comentario como resuelto si no lo resolviste
- Si el feedback aplica a múltiples lugares, busca todos y arréglalos, no solo donde el reviewer comentó

## Preguntas frecuentes

### ¿Puedo hacer push directo a main?

No. Main está protegida y requiere PR + review.

### ¿Qué hago si mi PR lleva mucho tiempo sin review?

Avisa al equipo. Si está bloqueado por más de 2 días sin razón, escala.

### ¿Puedo trabajar en varias ramas a la vez?

Sí, mientras no se pisen entre sí. Usa `git worktree` si necesitas dos ramas activas simultáneamente.

### ¿Qué hago si descubro un bug en main mientras trabajo en otra cosa?

Crea un issue separado y un PR de fix dedicado. No mezcles fixes con la feature actual.
