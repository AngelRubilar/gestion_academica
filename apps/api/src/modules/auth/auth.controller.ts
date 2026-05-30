import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ROLES } from '@gestion-academica/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { RequestUser } from '../../common/types/request-user';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Único endpoint protegido del módulo: crea usuarios. El guard global de auth
  // puebla request.user y @Roles restringe a SUPER_ADMIN/ADMIN.
  @Post('register')
  @Roles(ROLES.SUPER_ADMIN, ROLES.ADMIN)
  register(@Body() dto: RegisterDto, @CurrentUser() currentUser: RequestUser) {
    return this.authService.register(dto, currentUser);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto);
  }
}
