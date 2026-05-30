import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca una ruta como pública: el `JwtAuthGuard` global la deja pasar sin
 * requerir un access token. Usar en endpoints de auth (login, refresh) y en
 * sondas de salud. Todo lo que NO lleve `@Public()` queda autenticado por
 * defecto (guard global en `AppModule`).
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
