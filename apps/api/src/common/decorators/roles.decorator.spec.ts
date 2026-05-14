import { Reflector } from '@nestjs/core';
import { Roles, ROLES_KEY } from './roles.decorator';

describe('Roles decorator', () => {
  it('setea metadata con la lista de roles', () => {
    class Dummy {
      @Roles('ADMIN' as never, 'DIRECTOR' as never)
      handler() {}
    }
    const reflector = new Reflector();
    const value = reflector.get<string[]>(ROLES_KEY, Dummy.prototype.handler);
    expect(value).toEqual(['ADMIN', 'DIRECTOR']);
  });
});
