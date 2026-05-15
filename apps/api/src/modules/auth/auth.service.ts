import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ROLES } from '@gestion-academica/shared';
import type { Role } from '@gestion-academica/shared';
import type { RequestUser } from '../../common/types/request-user';
import { PrismaService } from '../../prisma/prisma.service';
import type { RegisterDto } from './dto/register.dto';
import { RefreshTokenService } from './refresh-token.service';

const BCRYPT_COST = 10;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SafeUser {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  async register(dto: RegisterDto, currentUser: RequestUser): Promise<SafeUser> {
    if (currentUser.role === ROLES.ADMIN && dto.role === ROLES.SUPER_ADMIN) {
      throw new ForbiddenException('Un ADMIN no puede crear usuarios SUPER_ADMIN');
    }
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('El email ya está registrado');
    }
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: await bcrypt.hash(dto.password, BCRYPT_COST),
        role: dto.role,
      },
    });
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}
