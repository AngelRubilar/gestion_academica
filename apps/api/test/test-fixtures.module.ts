import { Body, Controller, Get, Module, Post } from '@nestjs/common';
import { IsEmail, IsNotEmpty } from 'class-validator';

class ValidatePayload {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  name!: string;
}

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

@Module({
  controllers: [TestFixturesController],
})
export class TestFixturesModule {}
