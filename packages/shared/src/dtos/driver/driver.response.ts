import { VehicleType } from './enums';

export class DriverResponse {
  id: string;
  distance: number;
  lat: number;
  lng: number;
  vehicleType: VehicleType;
}
