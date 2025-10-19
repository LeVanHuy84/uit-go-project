import { IsEnum } from 'class-validator';
import { DriverStatus, VehicleType } from './enums';

export class UpdateDriverStatusDto {
  @IsEnum(DriverStatus)
  status: DriverStatus;

  @IsEnum(VehicleType)
  vehicleType: VehicleType;
}
