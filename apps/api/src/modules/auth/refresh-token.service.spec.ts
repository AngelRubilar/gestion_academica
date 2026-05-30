import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { parseDuration, RefreshTokenService } from './refresh-token.service';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('RefreshTokenService', () => {
  let prisma: {
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  const config = { get: jest.fn().mockReturnValue('7d') };
  let service: RefreshTokenService;

  beforeEach(() => {
    prisma = {
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    service = new RefreshTokenService(prisma as never, config as never);
  });

  describe('issue', () => {
    it('devuelve un token crudo de 64 chars hex y persiste solo su hash', async () => {
      prisma.refreshToken.create.mockResolvedValue({});

      const raw = await service.issue('user-1');

      expect(raw).toMatch(/^[a-f0-9]{64}$/);
      const createArg = prisma.refreshToken.create.mock.calls[0][0];
      expect(createArg.data.tokenHash).toBe(sha256(raw));
      expect(createArg.data.tokenHash).not.toBe(raw);
      expect(createArg.data.userId).toBe('user-1');
      expect(createArg.data.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('consume', () => {
    it('marca el token como revocado y devuelve el userId si está activo', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const userId = await service.consume('raw-token');

      expect(userId).toBe('user-1');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'rt-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('lanza UnauthorizedException si el token no existe', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.consume('raw-token')).rejects.toMatchObject({
        constructor: UnauthorizedException,
        message: 'Refresh token inválido',
      });
    });

    it('lanza UnauthorizedException si el token está expirado', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1_000),
      });

      await expect(service.consume('raw-token')).rejects.toMatchObject({
        constructor: UnauthorizedException,
        message: 'Refresh token inválido',
      });
    });

    it('detecta reuso: si el token ya está revocado, revoca todos los del usuario y lanza', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await expect(service.consume('raw-token')).rejects.toMatchObject({
        constructor: UnauthorizedException,
        message: 'Refresh token inválido',
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('revoke', () => {
    it('marca el token como revocado por su hash', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.revoke('raw-token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: sha256('raw-token'), revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('es idempotente: no lanza si el token no existe', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.revoke('raw-token')).resolves.toBeUndefined();
    });
  });
});

describe('parseDuration', () => {
  it('parsea segundos', () => {
    expect(parseDuration('30s')).toBe(30_000);
  });
  it('parsea minutos', () => {
    expect(parseDuration('15m')).toBe(15 * 60_000);
  });
  it('parsea horas', () => {
    expect(parseDuration('1h')).toBe(60 * 60_000);
  });
  it('parsea días', () => {
    expect(parseDuration('7d')).toBe(7 * 24 * 60 * 60_000);
  });
  it('lanza error si el formato es inválido (con espacio)', () => {
    expect(() => parseDuration('7 d')).toThrow('Formato de duración inválido');
  });
  it('lanza error si el formato es inválido (unidad desconocida)', () => {
    expect(() => parseDuration('7w')).toThrow('Formato de duración inválido');
  });
});
