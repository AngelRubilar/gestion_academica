import { CallHandler, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

function makeContext(req: { method: string; url: string }) {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('LoggingInterceptor', () => {
  let logger: {
    setContext: jest.Mock;
    debug: jest.Mock;
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
  };
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    logger = {
      setContext: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    interceptor = new LoggingInterceptor(logger as never);
  });

  it('loguea método/url/ms en éxito (nivel debug)', async () => {
    const ctx = makeContext({ method: 'GET', url: '/foo' });
    const handler: CallHandler = { handle: () => of('ok') };

    await firstValueFrom(interceptor.intercept(ctx, handler));

    expect(logger.debug).toHaveBeenCalledTimes(1);
    const arg = logger.debug.mock.calls[0][0];
    expect(arg).toMatchObject({ method: 'GET', url: '/foo', status: 'ok' });
    expect(typeof arg.ms).toBe('number');
  });

  it('loguea como warn en HttpException y re-lanza', async () => {
    const ctx = makeContext({ method: 'POST', url: '/bar' });
    const exc = new HttpException('nope', HttpStatus.FORBIDDEN);
    const handler: CallHandler = { handle: () => throwError(() => exc) };

    await expect(firstValueFrom(interceptor.intercept(ctx, handler))).rejects.toBe(exc);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][0]).toMatchObject({
      method: 'POST',
      url: '/bar',
      status: 'err',
      code: 403,
    });
  });

  it('loguea como error en excepción no HTTP, con payload completo, y re-lanza', async () => {
    const ctx = makeContext({ method: 'GET', url: '/baz' });
    const exc = new Error('boom');
    const handler: CallHandler = { handle: () => throwError(() => exc) };

    await expect(firstValueFrom(interceptor.intercept(ctx, handler))).rejects.toBe(exc);
    expect(logger.error).toHaveBeenCalledTimes(1);
    const arg = logger.error.mock.calls[0][0];
    expect(arg).toMatchObject({ method: 'GET', url: '/baz', status: 'err' });
    expect(arg.err).toBe(exc);
    expect(typeof arg.ms).toBe('number');
  });
});
