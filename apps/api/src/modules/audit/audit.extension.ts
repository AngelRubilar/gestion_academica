import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuditContextService } from './audit-context.service';
import { AUDITED_MODELS } from './audit.constants';
import { computeChanges, deriveAction } from './audit.changes';
import type { WriteOperation } from './audit.changes';

type Row = Record<string, unknown>;

/**
 * Extensión `query` que audita create/update/delete/upsert de los modelos del
 * allowlist. El log se escribe fire-and-forget para no bloquear la request.
 */
export function auditExtension(auditContext: AuditContextService) {
  const logger = new Logger('AuditExtension');

  return Prisma.defineExtension((client) => {
    // Los helpers se definen DENTRO del callback de defineExtension para que
    // cierren correctamente sobre `client`.

    function delegate(
      model: string,
    ): { findUnique: (a: unknown) => Promise<Row | null> } {
      const key = model.charAt(0).toLowerCase() + model.slice(1);
      return (
        client as unknown as Record<
          string,
          { findUnique: (a: unknown) => Promise<Row | null> }
        >
      )[key];
    }

    async function readPre(model: string, where: unknown): Promise<Row | undefined> {
      if (!AUDITED_MODELS.has(model)) return undefined;
      const found = await delegate(model).findUnique({ where });
      return found ?? undefined;
    }

    function writeLog(
      model: string,
      operation: WriteOperation,
      pre: Row | undefined,
      post: Row | undefined,
    ): void {
      if (!AUDITED_MODELS.has(model)) return;
      const ctx = auditContext.get();
      if (!ctx) {
        logger.debug(`Escritura en ${model} sin contexto de usuario; no se audita`);
        return;
      }
      const action = deriveAction(operation, pre, post);
      const entityId = String((post ?? pre)?.id ?? '');
      const changes = computeChanges(action, pre, post);

      // Fire-and-forget: no se await para no bloquear la request. AuditLog no está
      // en AUDITED_MODELS, así que este create no recursiona.
      void (
        client as unknown as {
          auditLog: { create: (a: unknown) => Promise<unknown> };
        }
      ).auditLog
        .create({
          data: {
            entityType: model,
            entityId,
            action,
            changes: changes as Prisma.InputJsonValue,
            userId: ctx.userId,
            userRole: ctx.userRole,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
          },
        })
        .catch((err: unknown) =>
          logger.error(`No se pudo escribir el audit log de ${model}`, err),
        );
    }

    return client.$extends({
      name: 'audit',
      query: {
        $allModels: {
          async create({ model, args, query }) {
            const result = (await query(args)) as Row;
            writeLog(model, 'create', undefined, result);
            return result;
          },
          async update({ model, args, query }) {
            const pre = await readPre(model, (args as { where: unknown }).where);
            const result = (await query(args)) as Row;
            writeLog(model, 'update', pre, result);
            return result;
          },
          async upsert({ model, args, query }) {
            const pre = await readPre(model, (args as { where: unknown }).where);
            const result = (await query(args)) as Row;
            writeLog(model, 'upsert', pre, result);
            return result;
          },
          async delete({ model, args, query }) {
            const pre = await readPre(model, (args as { where: unknown }).where);
            const result = (await query(args)) as Row;
            writeLog(model, 'delete', pre, result);
            return result;
          },
        },
      },
    });
  });
}
