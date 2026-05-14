import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { RequestUser } from '../types/request-user';

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
