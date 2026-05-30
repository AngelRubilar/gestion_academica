import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import { configureApp } from '../src/app.config';
import { AppModule } from '../src/app.module';
import type { Env } from '../src/config/env.schema';
import { TestFixturesModule } from './test-fixtures.module';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, TestFixturesModule],
    }).compile();

    app = moduleRef.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(Logger));

    const config = app.get<ConfigService<Env, true>>(ConfigService);
    configureApp(app, config);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health → 200 con la base de datos arriba', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.info.database.status).toBe('up');
  });

  it('GET /api/docs-json → spec OpenAPI con bearer auth declarado', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    expect(res.body.info.title).toBe('Gestión Académica API');
    expect(res.body.components.securitySchemes).toHaveProperty('bearer');
  });

  it('OPTIONS con Origin permitido → headers CORS presentes', async () => {
    const res = await request(app.getHttpServer())
      .options('/api/v1/__ok')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('GET /api/v1/__ok → 200 con cuerpo {data:"ok"} (ruta @Public)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/__ok').expect(200);
    expect(res.body).toEqual({ data: 'ok' });
  });

  it('GET /api/v1/__protected sin token → 401 (auth global por defecto)', async () => {
    await request(app.getHttpServer()).get('/api/v1/__protected').expect(401);
  });

  it('GET /api/v1/__nope → 404 con formato de error uniforme', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/__nope').expect(404);
    expect(res.body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      message: expect.any(String),
      path: '/api/v1/__nope',
    });
    expect(res.body.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T/);
    // errors are NOT wrapped in { data }
    expect(res.body).not.toHaveProperty('data');
  });

  it('POST /api/v1/__validate con body inválido → 400 con array de errores', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/__validate')
      .send({ email: 'no-es-email', name: '' })
      .expect(400);
    expect(res.body.statusCode).toBe(400);
    expect(Array.isArray(res.body.message)).toBe(true);
    expect(res.body.message.length).toBeGreaterThanOrEqual(2);
  });

  it('POST /api/v1/__validate rechaza props no whitelisted', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/__validate')
      .send({ email: 'a@b.cl', name: 'Ana', extra: 'no permitido' })
      .expect(400);
    expect(res.body.statusCode).toBe(400);
    expect(JSON.stringify(res.body.message)).toMatch(/extra/);
  });
});
