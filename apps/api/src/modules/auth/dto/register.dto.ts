import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { ROLES } from '@gestion-academica/shared';
import type { Role } from '@gestion-academica/shared';

const ROLE_VALUES = Object.values(ROLES);

export class RegisterDto {
  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsIn(ROLE_VALUES)
  role!: Role;
}
