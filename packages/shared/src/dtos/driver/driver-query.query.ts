import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';

export class DriverQuery {
  @IsNumber({}, { message: 'lat must be a number' })
  lat: number;

  @IsNumber({}, { message: 'lat must be a number' })
  lng: number;
}
