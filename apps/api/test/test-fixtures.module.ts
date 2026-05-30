import { Body, Controller, Get, Module, Post } from '@nestjs/common';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { Public } from '../src/common/decorators/public.decorator';

class ValidatePayload {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  name!: string;
}

// Fixtures de bootstrap (no de auth): quedan públicas para no depender de un
// token en los e2e que prueban validación/transform/filtros del pipeline HTTP.
@Public()
@Controller()
export class TestFixturesController {
  @Get('__ok')
  ok() {
    return 'ok';
  }

  @Post('__validate')
  validate(@Body() body: ValidatePayload) {
    return { received: body };
  }
}

// Sin @Public ni @Roles: sirve para verificar que el guard de auth global deja
// toda ruta autenticada por defecto (debe responder 401 sin token).
@Controller()
export class ProtectedFixturesController {
  @Get('__protected')
  protected() {
    return 'secreto';
  }
}

@Module({
  controllers: [TestFixturesController, ProtectedFixturesController],
})
export class TestFixturesModule {}
