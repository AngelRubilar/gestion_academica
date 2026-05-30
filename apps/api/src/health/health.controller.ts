import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { PrismaHealthIndicator } from './prisma.health';

// Sonda de salud pública: la consume el load balancer sin credenciales, por eso
// queda fuera del guard de auth global (@Public) y del throttle (@SkipThrottle).
@Public()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
// Health probes must never be throttled — a 429 reads as an unhealthy instance to a
// load balancer. The endpoint is read-only and touches no user data; a high-rate
// throttle override is deferred until the Redis-backed throttler exists (see spec).
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: PrismaHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }
}
