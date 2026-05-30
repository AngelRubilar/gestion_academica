import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Guard de autenticación global: valida el access token JWT y puebla
 * `request.user` con el `RequestUser` de `JwtStrategy.validate`. Está
 * registrado como `APP_GUARD` en `AppModule`, así que **toda** ruta queda
 * autenticada por defecto. Las rutas marcadas con `@Public()` se dejan pasar
 * sin token (login, refresh, health, etc.).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }
}
