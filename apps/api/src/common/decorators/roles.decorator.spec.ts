import { Reflector } from '@nestjs/core';
import { Roles, ROLES_KEY } from './roles.decorator';

describe('Roles decorator', () => {
  it('setea metadata con la lista de roles', () => {
    class Dummy {
      @Roles('ADMIN', 'DIRECTOR')
      handler() {}
    }
    // Real Reflector: we verify @Roles writes metadata that NestJS can read back.
    const reflector = new Reflector();
    const value = reflector.get<string[]>(ROLES_KEY, Dummy.prototype.handler);
    expect(value).toEqual(['ADMIN', 'DIRECTOR']);
  });
});
