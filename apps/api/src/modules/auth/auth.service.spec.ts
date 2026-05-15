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
});
