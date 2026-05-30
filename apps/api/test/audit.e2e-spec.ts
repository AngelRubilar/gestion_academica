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

const DOMAIN = '@e2e-audit.local';
const SUPERADMIN_EMAIL = `superadmin${DOMAIN}`;
const SUPERADMIN_PASSWORD = 'superadmin-e2e-pass';
const PROFESOR_EMAIL = `profesor${DOMAIN}`;
const PROFESOR_PASSWORD = 'profesor-e2e-pass';

describe('Audit (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  async function cleanup() {
    await prisma.auditLog.deleteMany({ where: { user: { email: { endsWith: DOMAIN } } } });
    await prisma.refreshToken.deleteMany({ where: { user: { email: { endsWith: DOMAIN } } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(Logger));
    configureApp(app, app.get<ConfigService<Env, true>>(ConfigService));
    await app.init();

    prisma = app.get(PrismaService);
    await cleanup();
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
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  async function login(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.data.accessToken;
  }

  it('POST /auth/register audita la creación del User con password redactado', async () => {
    const token = await login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    const nuevoEmail = `creado${DOMAIN}`;

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: nuevoEmail, password: 'secret1', role: 'PROFESOR' })
      .expect(201);

    // La escritura del log es fire-and-forget; damos un pequeño margen.
    await new Promise((r) => setTimeout(r, 200));

    const created = await prisma.user.findUnique({ where: { email: nuevoEmail } });
    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'User', entityId: created!.id },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('CREATE');
    expect(logs[0].userRole).toBe('SUPER_ADMIN');
    const changes = logs[0].changes as { new: Record<string, unknown> };
    expect(changes.new.email).toBe(nuevoEmail);
    expect(changes.new.password).toBe('[REDACTED]');
  });

  it('GET /audit-logs como SUPER_ADMIN → 200 con items', async () => {
    const token = await login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    const res = await request(app.getHttpServer())
      .get('/api/v1/audit-logs?entityType=User')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.total).toBeGreaterThanOrEqual(1);
  });

  it('GET /audit-logs como PROFESOR → 403', async () => {
    const token = await login(PROFESOR_EMAIL, PROFESOR_PASSWORD);
    await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /audit-logs sin token → 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/audit-logs').expect(401);
  });
});
