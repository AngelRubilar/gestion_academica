import { AuthGuard } from '@nestjs/passport';

/**
 * Valida el access token JWT y puebla `request.user` con el `RequestUser`
 * devuelto por `JwtStrategy.validate`. Usar junto a `RolesGuard`:
 * `@UseGuards(JwtAuthGuard, RolesGuard)`.
 */
export class JwtAuthGuard extends AuthGuard('jwt') {}
