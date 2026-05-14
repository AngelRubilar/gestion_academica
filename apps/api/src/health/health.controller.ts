import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaHealthIndicator } from './prisma.health';

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
