import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import {
  DRIVER_MESSAGE,
  DriverQuery,
  UpdateDriverStatusDto,
  UpdateLocationDto,
} from '@repo/shared';
import { MatchingService } from './matching.service';

@Controller('matching')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @MessagePattern('driver_reject_trip')
  async handleDriverRejected(
    @Payload() payload: { driverId: string; tripId: string },
  ) {
    return await this.matchingService.handleDriverRejected(
      payload.driverId,
      payload.tripId,
    );
  }

  @MessagePattern('driver_accept_trip')
  async handleDriverAccepted(
    @Payload() payload: { driverId: string; tripId: string },
  ) {
    return await this.matchingService.handleDriverAccepted(
      payload.driverId,
      payload.tripId,
    );
  }
}
