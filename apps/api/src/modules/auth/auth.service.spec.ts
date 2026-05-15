import { ConflictException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { RequestUser } from '../../common/types/request-user';
import { AuthService } from './auth.service';
import type { RegisterDto } from './dto/register.dto';

const SUPER_ADMIN: RequestUser = { id: 'sa', email: 'sa@b.cl', role: 'SUPER_ADMIN' };
const ADMIN: RequestUser = { id: 'ad', email: 'ad@b.cl', role: 'ADMIN' };

describe('AuthService', () => {
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock };
  };
  let jwt: { sign: jest.Mock };
  let refreshTokens: { issue: jest.Mock; consume: jest.Mock; revoke: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn(), create: jest.fn() } };
    jwt = { sign: jest.fn() };
    refreshTokens = { issue: jest.fn(), consume: jest.fn(), revoke: jest.fn() };
    service = new AuthService(prisma as never, jwt as never, refreshTokens as never);
  });

  describe('register', () => {
    const dto: RegisterDto = { email: 'nuevo@b.cl', password: 'secret1', role: 'PROFESOR' };

    function mockCreatedUser() {
      prisma.user.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'u2', isActive: true, createdAt: new Date(), ...data }),
      );
    }

    it('crea el usuario y devuelve sus datos sin el password', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      mockCreatedUser();

      const result = await service.register(dto, SUPER_ADMIN);

      expect(result).toEqual({
        id: 'u2',
        email: 'nuevo@b.cl',
        role: 'PROFESOR',
        isActive: true,
        createdAt: expect.any(Date),
      });
      expect(result).not.toHaveProperty('password');
    });

    it('hashea el password antes de guardarlo', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      mockCreatedUser();

      await service.register(dto, SUPER_ADMIN);

      const createArg = prisma.user.create.mock.calls[0][0];
      expect(createArg.data.password).not.toBe('secret1');
      expect(await bcrypt.compare('secret1', createArg.data.password)).toBe(true);
    });

    it('lanza ConflictException si el email ya está registrado', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existente' });

      await expect(service.register(dto, SUPER_ADMIN)).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('lanza ForbiddenException si un ADMIN intenta crear un SUPER_ADMIN', async () => {
      await expect(
        service.register({ ...dto, role: 'SUPER_ADMIN' }, ADMIN),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('permite a un ADMIN crear roles que no sean SUPER_ADMIN', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      mockCreatedUser();

      await expect(service.register({ ...dto, role: 'PROFESOR' }, ADMIN)).resolves.toBeDefined();
    });

    it('permite a un SUPER_ADMIN crear un SUPER_ADMIN', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      mockCreatedUser();

      await expect(
        service.register({ ...dto, role: 'SUPER_ADMIN' }, SUPER_ADMIN),
      ).resolves.toBeDefined();
    });
  });

  describe('login', () => {
    const PASSWORD = 'correcta1';
    const passwordHash = bcrypt.hashSync(PASSWORD, 10);

    function mockUser(overrides: Record<string, unknown> = {}) {
      return {
        id: 'u1',
        email: 'user@b.cl',
        password: passwordHash,
        role: 'PROFESOR',
        isActive: true,
        ...overrides,
      };
    }

    it('devuelve access token, refresh token y los datos del usuario', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser());
      jwt.sign.mockReturnValue('signed-access-token');
      refreshTokens.issue.mockResolvedValue('raw-refresh-token');

      const result = await service.login({ email: 'user@b.cl', password: PASSWORD });

      expect(result).toEqual({
        accessToken: 'signed-access-token',
        refreshToken: 'raw-refresh-token',
        user: { id: 'u1', email: 'user@b.cl', role: 'PROFESOR' },
      });
      expect(jwt.sign).toHaveBeenCalledWith({ sub: 'u1', email: 'user@b.cl', role: 'PROFESOR' });
      expect(refreshTokens.issue).toHaveBeenCalledWith('u1');
    });

    it('lanza UnauthorizedException si el password es incorrecto', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser());

      await expect(
        service.login({ email: 'user@b.cl', password: 'incorrecta' }),
      ).rejects.toThrow('Credenciales inválidas');
      expect(refreshTokens.issue).not.toHaveBeenCalled();
    });

    it('lanza UnauthorizedException si el email no existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'noexiste@b.cl', password: PASSWORD }),
      ).rejects.toThrow('Credenciales inválidas');
    });

    it('lanza UnauthorizedException si el usuario está inactivo', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser({ isActive: false }));

      await expect(
        service.login({ email: 'user@b.cl', password: PASSWORD }),
      ).rejects.toThrow('Credenciales inválidas');
    });
  });

  describe('logout', () => {
    it('revoca el refresh token recibido', async () => {
      refreshTokens.revoke.mockResolvedValue(undefined);

      await service.logout({ refreshToken: 'raw-refresh-token' });

      expect(refreshTokens.revoke).toHaveBeenCalledWith('raw-refresh-token');
    });
  });
});
