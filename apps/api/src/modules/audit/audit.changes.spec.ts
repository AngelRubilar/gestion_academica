import { AUDIT_ACTIONS } from '@gestion-academica/shared';
import { deriveAction, computeChanges } from './audit.changes';

describe('deriveAction', () => {
  it('create → CREATE', () => {
    expect(deriveAction('create', undefined, { id: '1' })).toBe(AUDIT_ACTIONS.CREATE);
  });

  it('delete → DELETE', () => {
    expect(deriveAction('delete', { id: '1' }, { id: '1' })).toBe(AUDIT_ACTIONS.DELETE);
  });

  it('update normal → UPDATE', () => {
    expect(deriveAction('update', { id: '1', email: 'a' }, { id: '1', email: 'b' })).toBe(
      AUDIT_ACTIONS.UPDATE,
    );
  });

  it('update con isActive true→false → DEACTIVATE', () => {
    expect(deriveAction('update', { id: '1', isActive: true }, { id: '1', isActive: false })).toBe(
      AUDIT_ACTIONS.DEACTIVATE,
    );
  });

  it('update con isActive false→true → REACTIVATE', () => {
    expect(deriveAction('update', { id: '1', isActive: false }, { id: '1', isActive: true })).toBe(
      AUDIT_ACTIONS.REACTIVATE,
    );
  });

  it('upsert sin pre-image (insertó) → CREATE', () => {
    expect(deriveAction('upsert', undefined, { id: '1' })).toBe(AUDIT_ACTIONS.CREATE);
  });

  it('upsert con pre-image (actualizó) → UPDATE', () => {
    expect(deriveAction('upsert', { id: '1', email: 'a' }, { id: '1', email: 'b' })).toBe(
      AUDIT_ACTIONS.UPDATE,
    );
  });
});

describe('computeChanges', () => {
  it('CREATE incluye el snapshot nuevo con password redactado', () => {
    const changes = computeChanges(AUDIT_ACTIONS.CREATE, undefined, {
      id: '1',
      email: 'a@b.cl',
      password: 'hash-secreto',
    });
    expect(changes).toEqual({
      new: { id: '1', email: 'a@b.cl', password: '[REDACTED]' },
    });
  });

  it('DELETE incluye el snapshot viejo redactado', () => {
    const changes = computeChanges(
      AUDIT_ACTIONS.DELETE,
      { id: '1', email: 'a@b.cl', password: 'h' },
      { id: '1' },
    );
    expect(changes).toEqual({ old: { id: '1', email: 'a@b.cl', password: '[REDACTED]' } });
  });

  it('UPDATE incluye solo los campos cambiados como {old,new}', () => {
    const changes = computeChanges(
      AUDIT_ACTIONS.UPDATE,
      { id: '1', email: 'a@b.cl', role: 'PROFESOR' },
      { id: '1', email: 'nuevo@b.cl', role: 'PROFESOR' },
    );
    expect(changes).toEqual({ email: { old: 'a@b.cl', new: 'nuevo@b.cl' } });
  });

  it('UPDATE redacta old y new de un campo sensible', () => {
    const changes = computeChanges(
      AUDIT_ACTIONS.UPDATE,
      { id: '1', password: 'viejo' },
      { id: '1', password: 'nuevo' },
    );
    expect(changes).toEqual({ password: { old: '[REDACTED]', new: '[REDACTED]' } });
  });

  it('compara fechas por valor, no por referencia', () => {
    const changes = computeChanges(
      AUDIT_ACTIONS.UPDATE,
      { id: '1', updatedAt: new Date('2026-01-01') },
      { id: '1', updatedAt: new Date('2026-01-01') },
    );
    expect(changes).toEqual({});
  });
});
