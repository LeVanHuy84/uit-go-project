import {
  Controller,
  Put,
  Inject,
  Get,
  Query,
  Body,
  Param,
  Post,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  DRIVER_MESSAGE,
  DriverQuery,
  SERVICE_NAME,
  UpdateDriverStatusDto,
  UpdateLocationDto,
} from '@repo/shared';
import { Public } from 'src/common/decorators/public.decorator';

@Controller({
  version: '1',
  path: 'drivers',
})
export class DriverController {
  constructor(
    @Inject(SERVICE_NAME.DRIVER_SERVICE)
    private client: ClientProxy,
  ) {}

  // Driver gọi hàm này để cập nhật vị trí
  @Put(':id/location')
  updateDriverLocation(
    @Param('id') id: string,
    @Body() data: UpdateLocationDto,
  ) {
    return this.client.emit(DRIVER_MESSAGE.UPDATE_LOCATION, { id, data });
  }

  // Driver gọi hàm này để cập nhật trạng thái
  @Put(':id/status')
  updateDriverStatus(
    @Param('id') id: string,
    @Body() data: UpdateDriverStatusDto,
  ) {
    return this.client.send(DRIVER_MESSAGE.UPDATE_STATUS, { id, data });
  }

  // Hàm để debug
  @Get('search')
  searchNearbyDrivers(@Query() query: DriverQuery) {
    return this.client.send(DRIVER_MESSAGE.SEARCH_NEARBY, query);
  }

  // Hàm để Debug
  @Public()
  @Get()
  getAllDrivers() {
    return this.client.send('get_all_locations', {});
  }

  @Post('reject')
  rejectTrip(@Body() body: { driverId: string; tripId: string }) {
    this.client.emit('driver_reject_trip', body);
    return { message: 'Pending request' };
  }

  @Post('accept')
  acceptTrip(@Body() body: { driverId: string; tripId: string }) {
    this.client.emit('driver_accept_trip', body);
    return { message: 'Pending request' };
  }
}
