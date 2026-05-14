import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

function makeCtx(user: unknown) {
  const handler = () => undefined;
  const Cls = function Cls() {};
  return {
    getHandler: () => handler,
    getClass: () => Cls,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  function makeGuard(metadata: unknown) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(metadata),
    } as unknown as Reflector;
    return { guard: new RolesGuard(reflector), reflector };
  }

  it('deja pasar si no hay metadata @Roles', () => {
    const { guard } = makeGuard(undefined);
    expect(guard.canActivate(makeCtx({ id: '1', role: 'ESTUDIANTE' }))).toBe(true);
  });

  it('deja pasar si el array de roles está vacío', () => {
    const { guard } = makeGuard([]);
    expect(guard.canActivate(makeCtx({ id: '1', role: 'ESTUDIANTE' }))).toBe(true);
  });

  it('rechaza si no hay user en el request', () => {
    const { guard } = makeGuard(['ADMIN']);
    expect(guard.canActivate(makeCtx(undefined))).toBe(false);
  });

  it('rechaza si el rol del user no está en la lista permitida', () => {
    const { guard } = makeGuard(['ADMIN', 'DIRECTOR']);
    expect(guard.canActivate(makeCtx({ id: '1', role: 'ESTUDIANTE' }))).toBe(false);
  });

  it('deja pasar si el rol del user está en la lista permitida', () => {
    const { guard } = makeGuard(['ADMIN', 'DIRECTOR']);
    expect(guard.canActivate(makeCtx({ id: '1', role: 'ADMIN' }))).toBe(true);
  });

  it('llama a getAllAndOverride con la key correcta y los targets correctos', () => {
    const { guard, reflector } = makeGuard(undefined);
    const ctx = makeCtx({ id: '1', role: 'ADMIN' });
    guard.canActivate(ctx);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
  });
});
