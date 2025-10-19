
import { Expose } from 'class-transformer';

export class TripRatingResponseDto {
  id: string;
  tripId: string;
  driverId: string;
  passengerId: string;
  rating: number;
  comment?: string;
  createdAt: Date;
}
