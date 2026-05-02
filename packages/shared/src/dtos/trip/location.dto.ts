import { IsNumber, IsOptional } from "class-validator";

export class LocationDto {
  @IsNumber()
  lat: number;
  @IsNumber()
  lng: number;
  @IsOptional()
  address?: string;
}
