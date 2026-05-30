import { Reflector } from '@nestjs/core';
import { Public, IS_PUBLIC_KEY } from './public.decorator';

describe('Public decorator', () => {
  it('setea metadata isPublic=true en el handler', () => {
    class Dummy {
      @Public()
      handler() {}
    }
    // Real Reflector: verificamos que @Public escribe metadata que NestJS lee.
    const reflector = new Reflector();
    const value = reflector.get<boolean>(IS_PUBLIC_KEY, Dummy.prototype.handler);
    expect(value).toBe(true);
  });
});
