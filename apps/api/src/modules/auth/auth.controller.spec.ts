import { AuthController } from './auth.controller';

describe('AuthController', () => {
  let authService: {
    register: jest.Mock;
    login: jest.Mock;
    refresh: jest.Mock;
    logout: jest.Mock;
  };
  let controller: AuthController;

  beforeEach(() => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
    };
    controller = new AuthController(authService as never);
  });

  it('register delega en authService.register con el dto y el currentUser', async () => {
    const dto = { email: 'a@b.cl', password: 'secret1', role: 'PROFESOR' } as never;
    const currentUser = { id: 'u1', email: 'admin@b.cl', role: 'ADMIN' } as never;
    const created = { id: 'u2' };
    authService.register.mockResolvedValue(created);

    await expect(controller.register(dto, currentUser)).resolves.toBe(created);
    expect(authService.register).toHaveBeenCalledWith(dto, currentUser);
  });

  it('login delega en authService.login con el dto', async () => {
    const dto = { email: 'a@b.cl', password: 'secret1' } as never;
    const tokens = { accessToken: 'a', refreshToken: 'r', user: {} };
    authService.login.mockResolvedValue(tokens);

    await expect(controller.login(dto)).resolves.toBe(tokens);
    expect(authService.login).toHaveBeenCalledWith(dto);
  });

  it('refresh delega en authService.refresh con el dto', async () => {
    const dto = { refreshToken: 'r' } as never;
    const tokens = { accessToken: 'a2', refreshToken: 'r2' };
    authService.refresh.mockResolvedValue(tokens);

    await expect(controller.refresh(dto)).resolves.toBe(tokens);
    expect(authService.refresh).toHaveBeenCalledWith(dto);
  });

  it('logout delega en authService.logout con el dto', async () => {
    const dto = { refreshToken: 'r' } as never;
    authService.logout.mockResolvedValue(undefined);

    await controller.logout(dto);
    expect(authService.logout).toHaveBeenCalledWith(dto);
  });
});
