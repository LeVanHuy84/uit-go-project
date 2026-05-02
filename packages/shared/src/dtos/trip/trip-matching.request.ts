import { VehicleType } from '../driver';

export class TripMatchingRequest {
  id: string;
  passengerId: string;
  vehicleType: VehicleType;
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  estimatedFare: number;
  createdAt: Date;
}
