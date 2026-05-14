import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;

  const ctxStub = {} as ExecutionContext;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  async function intercept(value: unknown): Promise<unknown> {
    const handler: CallHandler = { handle: () => of(value) };
    return firstValueFrom(interceptor.intercept(ctxStub, handler));
  }

  it('envuelve un string en {data}', async () => {
    expect(await intercept('hola')).toEqual({ data: 'hola' });
  });

  it('envuelve un array en {data}', async () => {
    expect(await intercept([1, 2, 3])).toEqual({ data: [1, 2, 3] });
  });

  it('envuelve null en {data: null}', async () => {
    expect(await intercept(null)).toEqual({ data: null });
  });

  it('envuelve un objeto en {data}', async () => {
    expect(await intercept({ id: 1 })).toEqual({ data: { id: 1 } });
  });

  it('envuelve undefined en {data: null}', async () => {
    expect(await intercept(undefined)).toEqual({ data: null });
  });
});
