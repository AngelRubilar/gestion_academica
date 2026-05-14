import { ExecutionContext } from '@nestjs/common';
import type { RequestUser } from '../types/request-user';
import { extractCurrentUser } from './current-user.decorator';

function makeCtx(user: unknown) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('CurrentUser decorator (extractor)', () => {
  it('devuelve request.user completo cuando no hay argumento', () => {
    const user = { id: 'u1', email: 'a@b.cl', role: 'ADMIN' };
    expect(extractCurrentUser(undefined, makeCtx(user))).toEqual(user);
  });

  it('devuelve solo el campo solicitado cuando se pasa un nombre', () => {
    const user = { id: 'u1', email: 'a@b.cl', role: 'ADMIN' };
    expect(extractCurrentUser('id', makeCtx(user))).toBe('u1');
  });

  it('devuelve undefined si no hay user en el request', () => {
    expect(extractCurrentUser(undefined, makeCtx(undefined))).toBeUndefined();
  });

  it('devuelve undefined si hay user pero el campo no existe', () => {
    // 'nope' is intentionally not a key of RequestUser — tests the missing-key runtime path.
    expect(extractCurrentUser('nope' as keyof RequestUser, makeCtx({ id: 'x' }))).toBeUndefined();
  });
});
