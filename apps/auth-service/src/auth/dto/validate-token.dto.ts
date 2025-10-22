import { IsNotEmpty } from 'class-validator';

export class ValidateTokenDto {
  @IsNotEmpty()
  token: string;
}