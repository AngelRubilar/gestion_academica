import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function makeHost(req: { url?: string } = {}) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };
  const request = { url: req.url ?? '/test' };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let logErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    logErrorSpy = jest.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logErrorSpy.mockRestore();
  });

  it('transforma HttpException en formato uniforme', () => {
    const { host, status, json } = makeHost({ url: '/api/v1/x' });
    const exc = new NotFoundException('No existe');

    filter.catch(exc, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No existe',
        error: 'Not Found',
        path: '/api/v1/x',
        timestamp: expect.stringMatching(/\d{4}-\d{2}-\d{2}T/),
      }),
    );
  });

  it('preserva el array de mensajes de class-validator', () => {
    const { host, json } = makeHost();
    const exc = new BadRequestException({
      message: ['email must be an email', 'name should not be empty'],
      error: 'Bad Request',
      statusCode: 400,
    });

    filter.catch(exc, host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: ['email must be an email', 'name should not be empty'],
        error: 'Bad Request',
      }),
    );
  });

  it('convierte error genérico en 500 sin exponer stack y lo loguea', () => {
    const { host, status, json } = makeHost({ url: '/foo' });
    const exc = new Error('boom');

    filter.catch(exc, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = json.mock.calls[0][0];
    expect(body.statusCode).toBe(500);
    expect(body.message).toBe('Internal server error');
    expect(body.error).toBe('Internal Server Error');
    expect(body).not.toHaveProperty('stack');
    expect(logErrorSpy).toHaveBeenCalledWith('boom', expect.any(String));
  });

  it('maneja HttpException con response como string', () => {
    const { host, json } = makeHost();
    const exc = new HttpException('error simple', HttpStatus.FORBIDDEN);

    filter.catch(exc, host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: 'error simple',
        error: 'Forbidden',
      }),
    );
  });

  it('loguea las HttpException con status 5xx', () => {
    const { host, status } = makeHost();
    const exc = new InternalServerErrorException('db down');

    filter.catch(exc, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(logErrorSpy).toHaveBeenCalled();
    expect(logErrorSpy.mock.calls[0][0]).toContain('500');
  });

  it('maneja throw de valor primitivo como 500', () => {
    const { host, status, json } = makeHost();

    filter.catch('algo raro', host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json.mock.calls[0][0].message).toBe('Internal server error');
    expect(logErrorSpy).toHaveBeenCalled();
  });
});
