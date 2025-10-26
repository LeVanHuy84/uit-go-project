import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { VehicleType } from '../driver';

export class CreateDriverProfileDto {
  @IsString()
  @IsNotEmpty()
  licenseNumber: string; // Số bằng lái

  @IsEnum(VehicleType)
  vehicleType: VehicleType; // MOTORBIKE | CAR_4_SEATS | CAR_7_SEATS

  @IsString()
  @IsNotEmpty()
  vehicleBrand: string; // Hãng xe

  @IsString()
  @IsNotEmpty()
  vehicleModel: string; // Dòng xe

  @IsString()
  @IsNotEmpty()
  licensePlate: string; // Biển số
}
