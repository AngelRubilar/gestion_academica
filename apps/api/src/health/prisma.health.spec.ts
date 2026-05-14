import { PrismaHealthIndicator } from './prisma.health';

describe('PrismaHealthIndicator', () => {
  const upResult = { database: { status: 'up' } };
  const downResult = { database: { status: 'down' } };
  let indicator: { up: jest.Mock; down: jest.Mock };
  let healthIndicatorService: { check: jest.Mock };
  let prisma: { $queryRaw: jest.Mock };
  let health: PrismaHealthIndicator;

  beforeEach(() => {
    indicator = {
      up: jest.fn().mockReturnValue(upResult),
      down: jest.fn().mockReturnValue(downResult),
    };
    healthIndicatorService = { check: jest.fn().mockReturnValue(indicator) };
    prisma = { $queryRaw: jest.fn() };
    health = new PrismaHealthIndicator(
      prisma as never,
      healthIndicatorService as never,
    );
    jest.spyOn(health['logger'], 'error').mockImplementation(() => undefined);
  });

  it('reporta up cuando SELECT 1 tiene éxito', async () => {
    prisma.$queryRaw.mockResolvedValue([{ result: 1 }]);

    const result = await health.pingCheck('database');

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(indicator.up).toHaveBeenCalled();
    expect(result).toBe(upResult);
  });

  it('reporta down con mensaje genérico cuando la query falla, sin re-lanzar', async () => {
    prisma.$queryRaw.mockRejectedValue(
      new Error('Authentication failed for user gestion_academica at host db:5432'),
    );

    const result = await health.pingCheck('database');

    expect(indicator.down).toHaveBeenCalledWith({ message: 'database ping failed' });
    expect(result).toBe(downResult);
    // the raw DB error must NOT leak into the down payload
    expect(indicator.down).not.toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Authentication'),
      }),
    );
  });

  it('loguea el error real server-side cuando la query falla', async () => {
    const dbError = new Error('connection refused');
    prisma.$queryRaw.mockRejectedValue(dbError);

    await health.pingCheck('database');

    expect(health['logger'].error).toHaveBeenCalledWith(
      'Database health check failed',
      dbError,
    );
  });
});
