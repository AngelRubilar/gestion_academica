// Modelos de dominio cuyas escrituras se auditan. Cada issue de CRUD agrega el
// suyo. RefreshToken/AuditLog quedan fuera por definición (plumbing / recursión).
export const AUDITED_MODELS = new Set<string>(['User']);

// Campos que nunca deben quedar en texto plano en un snapshot/diff.
export const REDACTED_FIELDS = new Set<string>(['password', 'tokenHash']);

export const REDACTED_VALUE = '[REDACTED]';
