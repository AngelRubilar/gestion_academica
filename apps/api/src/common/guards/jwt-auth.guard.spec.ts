import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

function makeCtx(): ExecutionContext {
  const handler = () => undefined;
  const Cls = function Cls() {};
  return {
    getHandler: () => handler,
    getClass: () => Cls,
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  function makeGuard(isPublic: unknown) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(isPublic),
    } as unknown as Reflector;
    return { guard: new JwtAuthGuard(reflector), reflector };
  }

  it('deja pasar sin autenticar si la ruta es @Public', () => {
    const { guard } = makeGuard(true);
    expect(guard.canActivate(makeCtx())).toBe(true);
  });

  it('delega en la autenticación JWT (super) si la ruta no es pública', () => {
    const { guard } = makeGuard(false);
    // Spy en el canActivate del padre (AuthGuard('jwt')) para no ejecutar passport real.
    const parentProto = Object.getPrototypeOf(Object.getPrototypeOf(guard));
    const superSpy = jest.spyOn(parentProto, 'canActivate').mockReturnValue('super-llamado');
    const ctx = makeCtx();

    const result = guard.canActivate(ctx);

    expect(superSpy).toHaveBeenCalledWith(ctx);
    expect(result).toBe('super-llamado');
    superSpy.mockRestore();
  });

  it('consulta IS_PUBLIC_KEY sobre handler y class', () => {
    const { guard, reflector } = makeGuard(true);
    const ctx = makeCtx();
    guard.canActivate(ctx);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
  });
});
