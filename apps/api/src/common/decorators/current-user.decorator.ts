import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { RequestUser } from '../types/request-user';

/**
 * Extrae el usuario autenticado del request.
 * - Sin `data`: devuelve el `RequestUser` completo (o `undefined` si no hay user).
 * - Con `data`: devuelve el valor de `user[data]` (o `undefined` si no hay user).
 * El tipo de retorno es amplio por la naturaleza del param decorator; los
 * consumidores anotan el tipo concreto en el parámetro del controlador.
 */
export function extractCurrentUser(
  data: keyof RequestUser | undefined,
  ctx: ExecutionContext,
): RequestUser | RequestUser[keyof RequestUser] | undefined {
  const request = ctx.switchToHttp().getRequest<{ user?: RequestUser }>();
  const user = request.user;
  if (!user) return undefined;
  return data ? user[data] : user;
}

export const CurrentUser = createParamDecorator(extractCurrentUser);
