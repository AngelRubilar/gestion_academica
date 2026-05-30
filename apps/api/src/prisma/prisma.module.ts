import {
  Global,
  Inject,
  Injectable,
  Module,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditContextModule } from '../modules/audit/audit-context.module';
import { AuditContextService } from '../modules/audit/audit-context.service';
import type { Env } from '../config/env.schema';
import { createPrismaClient, PrismaService } from './prisma.service';

// El cliente extendido no es una instancia de la clase PrismaService, así que
// los hooks de ciclo de vida se manejan en este provider dedicado.
@Injectable()
class PrismaLifecycle implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.prisma.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

@Global()
@Module({
  imports: [AuditContextModule],
  providers: [
    {
      provide: PrismaService,
      inject: [ConfigService, AuditContextService],
      useFactory: (config: ConfigService<Env, true>, auditContext: AuditContextService) =>
        createPrismaClient(config, auditContext),
    },
    PrismaLifecycle,
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
