import { Controller } from '@nestjs/common';
import { TripService } from './trip.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateTripDto, TRIP_MESSAGE } from '@repo/shared';
@Controller('trip')
export class TripController {
  constructor(private readonly tripService: TripService) {}

  @MessagePattern(TRIP_MESSAGE.CREATE_TRIP)
  create(@Payload() data: { dto: CreateTripDto}) {
    return this.tripService.create(data.dto);
  }
  @MessagePattern(TRIP_MESSAGE.GET_TRIP_BY_ID)
  findOne(@Payload() data: { id: string, userId: string }) {
    return this.tripService.findOne(data.id, data.userId);
  }

  @MessagePattern(TRIP_MESSAGE.CANCEL_TRIP)
  cancel(@Payload() data: { id: string; userId: string }) {
    return this.tripService.cancel(data.id, data.userId);
  }

  @MessagePattern(TRIP_MESSAGE.ACCEPT_TRIP)
  acceptTrip(@Payload() data: { id: string; driverId: string }) {
    return this.tripService.acceptTrip(data.id, data.driverId);
  }

  @MessagePattern(TRIP_MESSAGE.COMPLETE_TRIP)
  completeTrip(@Payload() data: { id: string; driverId: string }) {
    return this.tripService.completeTrip(data.id, data.driverId);
  }


}
