import {
  Controller,
  Put,
  Inject,
  Get,
  Query,
  Body,
  Param,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  DRIVER_MESSAGE,
  DriverQuery,
  DriverStatus,
  SERVICE_NAME,
  UpdateLocationDto,
} from '@repo/shared';

@Controller('drivers')
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
    @Body('status') status: DriverStatus,
  ) {
    return this.client.emit(DRIVER_MESSAGE.UPDATE_STATUS, { id, status });
  }

  // Hàm để debug
  @Get('search')
  searchNearbyDrivers(@Query() query: DriverQuery) {
    console.log('query', query);
    return this.client.send(DRIVER_MESSAGE.SEARCH_NEARBY, query);
  }

  // Hàm để Debug
  @Get()
  getAllDrivers() {
    return this.client.send('get_all_locations', {});
  }
}
