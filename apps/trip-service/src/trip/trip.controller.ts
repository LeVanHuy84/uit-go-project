import { Controller } from '@nestjs/common';
import { TripService } from './trip.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateTripDto } from '@repo/share-dto';

@Controller('trip')
export class TripController {
  constructor(private readonly tripService: TripService) {}

  @MessagePattern('create_trip')
  create(@Payload() data: CreateTripDto) {
    return this.tripService.createTrip(data);
  }

  @MessagePattern('get_trip_by_id')
  getOne(@Payload('id') id: string) {
    return this.tripService.getTrip(id);
  }
  @MessagePattern('cancel_trip')
  cancel(@Payload('id') id: string) {
    return this.tripService.cancelTrip(id);
  }
}
