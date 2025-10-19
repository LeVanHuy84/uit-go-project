import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsString,
  ValidateNested,
} from 'class-validator';
import { LocationDto } from './location.dto';
import { VehicleType } from '../driver';

export class CreateTripDto {
  @IsString()
  @IsNotEmpty()
  passengerId: string;

  @IsEnum(VehicleType)
  @IsNotEmpty()
  vehicleType: VehicleType;

  @ValidateNested()
  @Type(() => LocationDto)
  pickup: LocationDto;

  @ValidateNested()
  @Type(() => LocationDto)
  dropOff: LocationDto;
}
