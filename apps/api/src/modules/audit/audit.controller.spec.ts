import { AuditController } from './audit.controller';

describe('AuditController', () => {
  let auditService: {
    findMany: jest.Mock;
    findByEntity: jest.Mock;
    findByUser: jest.Mock;
  };
  let controller: AuditController;

  beforeEach(() => {
    auditService = { findMany: jest.fn(), findByEntity: jest.fn(), findByUser: jest.fn() };
    controller = new AuditController(auditService as never);
  });

  it('list delega en findMany separando filtros de paginación', async () => {
    const page = { items: [], total: 0, page: 1, pageSize: 20 };
    auditService.findMany.mockResolvedValue(page);

    const query = { entityType: 'User', page: 1, pageSize: 20 } as never;
    await expect(controller.list(query)).resolves.toBe(page);
    expect(auditService.findMany).toHaveBeenCalledWith(
      { entityType: 'User', entityId: undefined, userId: undefined, action: undefined, from: undefined, to: undefined },
      { page: 1, pageSize: 20 },
    );
  });

  it('byEntity delega en findByEntity', async () => {
    auditService.findByEntity.mockResolvedValue([]);
    await controller.byEntity('User', 'u1');
    expect(auditService.findByEntity).toHaveBeenCalledWith('User', 'u1');
  });

  it('byUser delega en findByUser', async () => {
    auditService.findByUser.mockResolvedValue([]);
    await controller.byUser('admin');
    expect(auditService.findByUser).toHaveBeenCalledWith('admin');
  });
});
