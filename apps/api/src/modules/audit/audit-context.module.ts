import { Global, Module } from '@nestjs/common';
import { AuditContextService } from './audit-context.service';

// Módulo propio sin dependencias: lo consumen tanto PrismaModule (para la
// extensión) como AuditModule, sin crear un ciclo entre ellos.
@Global()
@Module({
  providers: [AuditContextService],
  exports: [AuditContextService],
})
export class AuditContextModule {}
