import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import type { Env } from '../../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';

const DURATION_UNITS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function parseDuration(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) {
    throw new Error(`Formato de duración inválido: ${value}`);
  }
  return Number(match[1]) * DURATION_UNITS[match[2]];
}

const INVALID_TOKEN_MESSAGE = 'Refresh token inválido';

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async issue(userId: string): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const expiresInMs = parseDuration(this.config.get('JWT_REFRESH_EXPIRES_IN', { infer: true }));
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hash(rawToken),
        userId,
        expiresAt: new Date(Date.now() + expiresInMs),
      },
    });
    return rawToken;
  }

  async consume(rawToken: string): Promise<string> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(rawToken) },
    });
    if (!stored) {
      throw new UnauthorizedException(INVALID_TOKEN_MESSAGE);
    }
    if (stored.revokedAt) {
      this.logger.warn(`Detección de reuso de refresh token para usuario ${stored.userId}`);
      await this.revokeAllForUser(stored.userId);
      throw new UnauthorizedException(INVALID_TOKEN_MESSAGE);
    }
    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException(INVALID_TOKEN_MESSAGE);
    }
    const updated = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (updated.count === 0) {
      // Perdimos la carrera — otro caller ya consumió este token. Eso es reuso.
      this.logger.warn(`Detección de reuso de refresh token (carrera) para usuario ${stored.userId}`);
      await this.revokeAllForUser(stored.userId);
      throw new UnauthorizedException(INVALID_TOKEN_MESSAGE);
    }
    return stored.userId;
  }

  async revoke(rawToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hash(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private hash(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
