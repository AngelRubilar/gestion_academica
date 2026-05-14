import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@gestion-academica/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { RequestUser } from '../types/request-user';

/**
 * STUB — requiere que un guard previo (JwtAuthGuard, issue #6) pueble
 * `request.user`. Sin ese guard, `request.user` es siempre `undefined` y
 * este guard deniega todo endpoint protegido con `@Roles()`.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;
    if (!user) return false;

    return requiredRoles.includes(user.role);
  }
}
