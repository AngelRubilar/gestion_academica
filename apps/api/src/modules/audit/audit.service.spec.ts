import { AUDIT_ACTIONS } from '@gestion-academica/shared';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let prisma: { auditLog: { create: jest.Mock; findMany: jest.Mock; count: jest.Mock } };
  let service: AuditService;

  beforeEach(() => {
    prisma = {
      auditLog: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    };
    service = new AuditService(prisma as never);
  });

  describe('log', () => {
    it('inserta una fila con los datos provistos', async () => {
      prisma.auditLog.create.mockResolvedValue({ id: 'a1' });
      await service.log({
        entityType: 'User',
        entityId: 'u1',
        action: AUDIT_ACTIONS.CREATE,
        changes: { new: { id: 'u1' } },
        context: { userId: 'admin', userRole: 'ADMIN', ipAddress: '1.1.1.1', userAgent: 'jest' },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          entityType: 'User',
          entityId: 'u1',
          action: AUDIT_ACTIONS.CREATE,
          changes: { new: { id: 'u1' } },
          userId: 'admin',
          userRole: 'ADMIN',
          ipAddress: '1.1.1.1',
          userAgent: 'jest',
        },
      });
    });
  });

  describe('findMany', () => {
    it('aplica filtros y paginación y devuelve items + total', async () => {
      prisma.auditLog.findMany.mockResolvedValue([{ id: 'a1' }]);
      prisma.auditLog.count.mockResolvedValue(1);

      const result = await service.findMany(
        { entityType: 'User', action: AUDIT_ACTIONS.CREATE, from: new Date('2026-01-01') },
        { page: 2, pageSize: 10 },
      );

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          entityType: 'User',
          action: AUDIT_ACTIONS.CREATE,
          createdAt: { gte: new Date('2026-01-01') },
        },
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 10,
      });
      expect(result).toEqual({ items: [{ id: 'a1' }], total: 1, page: 2, pageSize: 10 });
    });

    it('sin filtros usa where vacío y página 1 por defecto', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);
      await service.findMany({}, {});
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });
  });

  describe('findByEntity', () => {
    it('filtra por entityType y entityId', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      await service.findByEntity('User', 'u1');
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { entityType: 'User', entityId: 'u1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findByUser', () => {
    it('filtra por userId', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      await service.findByUser('admin');
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { userId: 'admin' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
