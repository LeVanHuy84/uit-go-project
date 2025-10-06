import { TripStatus } from "./enum/trip-status.enum";
import { LocationDto } from "./location.dto";


export class TripResponseDto {
  id: string;
  passengerId: string;
  driverId?: string;
  status: TripStatus;
  pickupLocation?: LocationDto;
  dropOffLocation?: LocationDto;
  createdAt: Date;
}
