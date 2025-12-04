import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { CreateTripDto, SERVICE_NAME, TRIP_MESSAGE } from '@repo/shared';
import { CurrentUserId } from 'src/common/decorators/current-user-id.decorator';
import { Public } from 'src/common/decorators/public.decorator';

@Controller({
  version: '1',
  path: 'trips',
})
export class TripController {
  constructor(
    @Inject(SERVICE_NAME.TRIP_SERVICE)
    private readonly tripServiceClient: ClientProxy,
  ) {}

  @Post('price-estimate')
  getPriceEstimate(@Body() dto: CreateTripDto) {
    return this.tripServiceClient.send(TRIP_MESSAGE.GET_PRICE_ESTIMATE, dto);
  }

  @Get(':id')
  getTripById(@Param('id') id: string, @Req() req) {
    const userId = req.user?.userId;
    return this.tripServiceClient.send(TRIP_MESSAGE.GET_TRIP_BY_ID, {
      id,
      userId,
    });
  }

  @Post()
  createTrip(@Body() dto: CreateTripDto, @Req() req) {
    const userId = req.user?.userId;
    return this.tripServiceClient.send(TRIP_MESSAGE.CREATE_TRIP, {
      dto,
      userId,
    });
  }

  @Post(':id/cancel')
  cancelTrip(@Param('id') id: string, @Req() req) {
    const userId = req.user?.userId;
    return this.tripServiceClient.send(TRIP_MESSAGE.CANCEL_TRIP, {
      id,
      userId,
    });
  }

  @Post(':id/accept')
  acceptTrip(@Param('id') id: string, @Req() req) {
    const driverId = req.user?.userId;
    return this.tripServiceClient.send(TRIP_MESSAGE.ACCEPT_TRIP, {
      id,
      driverId,
    });
  }

  @Post(':id/complete')
  completeTrip(@Param('id') id: string, @Req() req) {
    const driverId = req.user?.userId;
    this.tripServiceClient.emit(TRIP_MESSAGE.COMPLETE_TRIP, {
      id,
      driverId,
    });
    return { message: 'Pending request' };
  }

  @Post(':id/rating')
  rateTrip(@Param('id') tripId: string, @Body() dto, @Req() req) {
    const userId = req.user?.userId;
    return this.tripServiceClient.send(TRIP_MESSAGE.RATING_TRIP, {
      tripId,
      userId,
      dto,
    });
  }
}
