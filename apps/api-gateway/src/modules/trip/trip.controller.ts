import { Body, Controller, Get, Inject, Post, Req } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { CreateTripDto, SERVICE_NAME, TRIP_MESSAGE } from '@repo/shared';
import { Public } from 'src/common/decorators/public.decorator';


@Controller({
  version: '1',
  path: 'trips'
})
export class TripController {
  constructor(
    @Inject(SERVICE_NAME.TRIP_SERVICE)
    private readonly tripServiceClient: ClientProxy,
  ) {}

  @Get(':id')
  getTripById(@Body('id') id: string, @Req() req) {
    const userId = req.user?.userId;
    return this.tripServiceClient.send(TRIP_MESSAGE.GET_TRIP_BY_ID, { id, userId });
  }

  @Public()
  @Post()
  createTrip(@Body() dto: CreateTripDto) {
    return this.tripServiceClient.send(TRIP_MESSAGE.CREATE_TRIP, { dto });
  }

  @Post(':id/cancel')
  cancelTrip(@Body('id') id: string, @Req() req) {
    const userId = req.user?.userId;
    return this.tripServiceClient.send(TRIP_MESSAGE.CANCEL_TRIP, { id, userId });
  }
  
  @Post(':id/accept')
  acceptTrip(@Body('id') id: string, @Req() req) {
    const driverId = req.user?.userId;
    return this.tripServiceClient.send(TRIP_MESSAGE.ACCEPT_TRIP, { id, driverId });
  }

  @Post(':id/complete')
  completeTrip(@Body('id') id: string, @Req() req) {
    const driverId = req.user?.userId;
    return this.tripServiceClient.send(TRIP_MESSAGE.COMPLETE_TRIP, { id, driverId });
  }

}
