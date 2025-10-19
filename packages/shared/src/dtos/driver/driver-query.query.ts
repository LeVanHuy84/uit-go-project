import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { VehicleType } from './enums';

export class DriverQuery {
  @IsNumber({}, { message: 'lat must be a number' })
  lat: number;

  @IsNumber({}, { message: 'lat must be a number' })
  lng: number;

  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;
}
