import { IsString } from 'class-validator';

export class ExampleDto {
  @IsString()
  message: string;
}
