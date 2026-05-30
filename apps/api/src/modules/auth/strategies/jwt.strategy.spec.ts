import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const config = {
    get: jest.fn().mockReturnValue('test-secret-de-al-menos-32-caracteres-xx'),
  };
  let prisma: { user: { findUnique: jest.Mock } };
  let strategy: JwtStrategy;

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() } };
    strategy = new JwtStrategy(config as never, prisma as never);
  });

  it('devuelve el RequestUser cuando el usuario existe y está activo', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.cl',
      role: 'ADMIN',
      isActive: true,
    });

    const result = await strategy.validate({ sub: 'u1', email: 'a@b.cl', role: 'ADMIN' });

    expect(result).toEqual({ id: 'u1', email: 'a@b.cl', role: 'ADMIN' });
  });

  it('lanza UnauthorizedException si el usuario no existe', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(strategy.validate({ sub: 'u1', email: 'a@b.cl', role: 'ADMIN' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('lanza UnauthorizedException si el usuario está inactivo', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.cl',
      role: 'ADMIN',
      isActive: false,
    });

    await expect(strategy.validate({ sub: 'u1', email: 'a@b.cl', role: 'ADMIN' })).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
