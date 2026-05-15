import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ROLES } from '@gestion-academica/shared';
import type { Role } from '@gestion-academica/shared';
import type { RequestUser } from '../../common/types/request-user';
import { PrismaService } from '../../prisma/prisma.service';
import type { LoginDto } from './dto/login.dto';
import type { LogoutDto } from './dto/logout.dto';
import type { RegisterDto } from './dto/register.dto';
import { RefreshTokenService } from './refresh-token.service';
import type { JwtPayload } from './strategies/jwt.strategy';

const BCRYPT_COST = 10;

// Hash con forma de bcrypt real: la comparación en login corre siempre, exista
// o no el usuario, para no filtrar usuarios por timing.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-sin-usuario', BCRYPT_COST);

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

  async login(dto: LoginDto): Promise<AuthTokens & { user: RequestUser }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const passwordMatches = await bcrypt.compare(dto.password, user?.password ?? DUMMY_HASH);
    if (!user || !passwordMatches || !user.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const requestUser: RequestUser = { id: user.id, email: user.email, role: user.role };
    const tokens = await this.issueTokens(requestUser);
    return { ...tokens, user: requestUser };
  }

  async logout(dto: LogoutDto): Promise<void> {
    await this.refreshTokens.revoke(dto.refreshToken);
  }

  private async issueTokens(user: RequestUser): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: this.jwt.sign(payload),
      refreshToken: await this.refreshTokens.issue(user.id),
    };
  }
}
