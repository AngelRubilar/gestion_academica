import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import { auditExtension } from '../modules/audit/audit.extension';
import { AuditContextService } from '../modules/audit/audit-context.service';

/**
 * Crea el PrismaClient con el adapter pg y la extensión de auditoría aplicada.
 * El cliente extendido conserva los mismos delegates (`.user`, `.auditLog`, …),
 * por eso los call sites que inyectan `PrismaService` no cambian.
 */
export function createPrismaClient(
  config: ConfigService<Env, true>,
  auditContext: AuditContextService,
) {
  const base = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: config.get('DATABASE_URL', { infer: true }),
    }),
    log:
      config.get('NODE_ENV', { infer: true }) === 'development'
        ? ['warn', 'error']
        : ['error'],
  });
  return base.$extends(auditExtension(auditContext));
}

// Token de inyección + tipo. La instancia real es el cliente extendido (la crea
// el factory de PrismaModule). No instanciar esta clase directamente.
export class PrismaService extends PrismaClient {}
