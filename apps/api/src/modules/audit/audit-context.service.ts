import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Role } from '@gestion-academica/shared';
import type { RequestUser } from '../../common/types/request-user';

interface AuditRequest {
  user?: RequestUser;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

export interface AuditContext {
  userId: string;
  userRole: Role;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditContextService {
  private readonly als = new AsyncLocalStorage<AuditRequest>();

  run<T>(req: AuditRequest, fn: () => T): T {
    return this.als.run(req, fn);
  }

  get(): AuditContext | undefined {
    const req = this.als.getStore();
    const user = req?.user;
    if (!req || !user) {
      return undefined;
    }
    const ua = req.headers['user-agent'];
    return {
      userId: user.id,
      userRole: user.role,
      ipAddress: req.ip,
      userAgent: Array.isArray(ua) ? ua[0] : ua,
    };
  }
}
