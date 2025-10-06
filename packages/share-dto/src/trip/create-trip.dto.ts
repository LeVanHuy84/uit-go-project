import { IsNotEmpty, IsObject, IsString, ValidateNested } from 'class-validator';

import { Type } from 'class-transformer';
import { LocationDto } from './location.dto';



export class CreateTripDto {
  @IsString()
  @IsNotEmpty()
  passengerId: string;

  @ValidateNested()
  @Type(() => LocationDto)
  pickup: LocationDto;

  @IsObject()
  @IsNotEmpty()
  dropOff: LocationDto;
}
