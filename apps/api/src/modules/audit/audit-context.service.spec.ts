import { AuditContextService } from './audit-context.service';

function fakeReq(over: Record<string, unknown> = {}) {
  return {
    user: { id: 'u1', email: 'a@b.cl', role: 'ADMIN' },
    ip: '10.0.0.1',
    headers: { 'user-agent': 'jest' },
    ...over,
  } as never;
}

describe('AuditContextService', () => {
  let service: AuditContextService;

  beforeEach(() => {
    service = new AuditContextService();
  });

  it('fuera de run() no hay contexto', () => {
    expect(service.get()).toBeUndefined();
  });

  it('dentro de run() expone userId, userRole, ip y user-agent', () => {
    service.run(fakeReq(), () => {
      expect(service.get()).toEqual({
        userId: 'u1',
        userRole: 'ADMIN',
        ipAddress: '10.0.0.1',
        userAgent: 'jest',
      });
    });
  });

  it('si la request no tiene user, get() devuelve undefined (no se audita)', () => {
    service.run(fakeReq({ user: undefined }), () => {
      expect(service.get()).toBeUndefined();
    });
  });

  it('propaga el contexto a través de awaits', async () => {
    await service.run(fakeReq(), async () => {
      await Promise.resolve();
      expect(service.get()?.userId).toBe('u1');
    });
  });
});
