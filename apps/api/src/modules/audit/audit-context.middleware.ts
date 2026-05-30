import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { AuditContextService } from './audit-context.service';

/**
 * Establece el store de ALS para toda la vida de la request. Corre ANTES de los
 * guards, así que `req.user` aún no existe acá; se guarda la request y el `.user`
 * se lee al momento de escribir el log (ya poblado por JwtAuthGuard).
 */
@Injectable()
export class AuditContextMiddleware implements NestMiddleware {
  constructor(private readonly auditContext: AuditContextService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    this.auditContext.run(req as Parameters<AuditContextService['run']>[0], () => next());
  }
}
