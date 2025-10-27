import { IsEmail, IsNotEmpty, MinLength, IsOptional, IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  fullName: string;

  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsOptional()
  phone?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}