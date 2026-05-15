import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import { configureApp } from '../src/app.config';
import { AppModule } from '../src/app.module';
import type { Env } from '../src/config/env.schema';
import { PrismaService } from '../src/prisma/prisma.service';

const TEST_EMAIL_DOMAIN = '@e2e-auth.local';
const SUPERADMIN_EMAIL = `superadmin${TEST_EMAIL_DOMAIN}`;
const SUPERADMIN_PASSWORD = 'superadmin-e2e-pass';
const PROFESOR_EMAIL = `profesor${TEST_EMAIL_DOMAIN}`;
const PROFESOR_PASSWORD = 'profesor-e2e-pass';
const ADMIN_EMAIL = `admin${TEST_EMAIL_DOMAIN}`;
const ADMIN_PASSWORD = 'admin-e2e-pass';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(Logger));
    const config = app.get<ConfigService<Env, true>>(ConfigService);
    configureApp(app, config);
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_EMAIL_DOMAIN } } });
    await prisma.user.create({
      data: {
        email: SUPERADMIN_EMAIL,
        password: await bcrypt.hash(SUPERADMIN_PASSWORD, 10),
        role: 'SUPER_ADMIN',
      },
    });
    await prisma.user.create({
      data: {
        email: PROFESOR_EMAIL,
        password: await bcrypt.hash(PROFESOR_PASSWORD, 10),
        role: 'PROFESOR',
      },
    });
    await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        password: await bcrypt.hash(ADMIN_PASSWORD, 10),
        role: 'ADMIN',
      },
    });
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({
      where: { user: { email: { endsWith: TEST_EMAIL_DOMAIN } } },
    });
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_EMAIL_DOMAIN } } });
    await app.close();
  });

  it('POST /api/v1/auth/login con credenciales válidas → 200 con tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD })
      .expect(200);

    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toEqual(expect.any(String));
    expect(res.body.data.user).toMatchObject({
      email: SUPERADMIN_EMAIL,
      role: 'SUPER_ADMIN',
    });
  });

  it('POST /api/v1/auth/login con credenciales inválidas → 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SUPERADMIN_EMAIL, password: 'password-incorrecta' })
      .expect(401);
  });

  it('POST /api/v1/auth/register sin token → 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: `nuevo${TEST_EMAIL_DOMAIN}`, password: 'secret1', role: 'PROFESOR' })
      .expect(401);
  });

  it('POST /api/v1/auth/register con rol insuficiente → 403', async () => {
    const server = request(app.getHttpServer());

    const login = await server
      .post('/api/v1/auth/login')
      .send({ email: PROFESOR_EMAIL, password: PROFESOR_PASSWORD })
      .expect(200);

    await server
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .send({ email: `nuevo${TEST_EMAIL_DOMAIN}`, password: 'secret1', role: 'PROFESOR' })
      .expect(403);
  });

  it('POST /api/v1/auth/register: un ADMIN no puede crear un SUPER_ADMIN → 403', async () => {
    const server = request(app.getHttpServer());

    const login = await server
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);

    await server
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .send({ email: `superadmin-nuevo${TEST_EMAIL_DOMAIN}`, password: 'secret1', role: 'SUPER_ADMIN' })
      .expect(403);
  });

  it('flujo completo: login → register protegido → refresh con rotación → reuso bloqueado → logout', async () => {
    const server = request(app.getHttpServer());

    const login = await server
      .post('/api/v1/auth/login')
      .send({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD })
      .expect(200);
    const { accessToken, refreshToken } = login.body.data;

    // el access token autoriza el endpoint protegido /auth/register
    const created = await server
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email: `creado${TEST_EMAIL_DOMAIN}`, password: 'secret1', role: 'PROFESOR' })
      .expect(201);
    expect(created.body.data).not.toHaveProperty('password');

    // refresh rota los tokens
    const refreshed = await server
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    const newRefreshToken = refreshed.body.data.refreshToken;
    expect(newRefreshToken).not.toBe(refreshToken);

    // reusar el refresh token viejo → 401 (detección de reuso)
    await server.post('/api/v1/auth/refresh').send({ refreshToken }).expect(401);

    // el reuso revocó toda la familia: el token nuevo tampoco sirve
    await server
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: newRefreshToken })
      .expect(401);

    // logout responde 204 y es idempotente
    await server
      .post('/api/v1/auth/logout')
      .send({ refreshToken: newRefreshToken })
      .expect(204);
  });
});
