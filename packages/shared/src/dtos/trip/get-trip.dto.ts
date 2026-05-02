import { TripStatus } from "./enum";

export class TripResponseDto {
  id: string;
  passengerId: string;
  driverId?: string;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  estimatedFare: number;
  status: TripStatus;
  createdAt: Date;
  updatedAt: Date;
}
