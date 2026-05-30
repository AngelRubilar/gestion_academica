import { AUDIT_ACTIONS } from '@gestion-academica/shared';
import type { AuditAction } from '@gestion-academica/shared';
import { REDACTED_FIELDS, REDACTED_VALUE } from './audit.constants';

export type WriteOperation = 'create' | 'update' | 'delete' | 'upsert';
type Row = Record<string, unknown>;

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (a === b) return true;
  // Comparación estructural de respaldo para objetos/arrays anidados.
  // Limitación conocida: JSON.stringify es sensible al orden de claves y descarta
  // valores undefined; en la práctica las filas de Prisma no traen undefined (null ≠ ausente).
  return JSON.stringify(a) === JSON.stringify(b);
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  if (value !== null && typeof value === 'object' && (value as object).constructor === Object) {
    return redactSnapshot(value as Row);
  }
  return value;
}

function redactSnapshot(row: Row): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = REDACTED_FIELDS.has(key) ? REDACTED_VALUE : redactValue(value);
  }
  return out;
}

function redactField(key: string, value: unknown): unknown {
  if (REDACTED_FIELDS.has(key)) return REDACTED_VALUE;
  return redactValue(value);
}

export function deriveAction(
  operation: WriteOperation,
  pre: Row | undefined,
  post: Row | undefined,
): AuditAction {
  if (operation === 'create') return AUDIT_ACTIONS.CREATE;
  if (operation === 'delete') return AUDIT_ACTIONS.DELETE;
  // update | upsert
  if (!pre) return AUDIT_ACTIONS.CREATE; // upsert que insertó
  if (pre.isActive === true && post?.isActive === false) return AUDIT_ACTIONS.DEACTIVATE;
  if (pre.isActive === false && post?.isActive === true) return AUDIT_ACTIONS.REACTIVATE;
  return AUDIT_ACTIONS.UPDATE;
}

export function computeChanges(
  action: AuditAction,
  pre: Row | undefined,
  post: Row | undefined,
): Record<string, unknown> {
  if (action === AUDIT_ACTIONS.CREATE) {
    return { new: redactSnapshot(post ?? {}) };
  }
  if (action === AUDIT_ACTIONS.DELETE) {
    return { old: redactSnapshot(pre ?? post ?? {}) };
  }
  // UPDATE | DEACTIVATE | REACTIVATE → diff campo a campo
  const diff: Record<string, { old: unknown; new: unknown }> = {};
  const keys = new Set([...Object.keys(pre ?? {}), ...Object.keys(post ?? {})]);
  for (const key of keys) {
    const oldValue = pre?.[key];
    const newValue = post?.[key];
    if (!valuesEqual(oldValue, newValue)) {
      diff[key] = { old: redactField(key, oldValue), new: redactField(key, newValue) };
    }
  }
  return diff;
}
