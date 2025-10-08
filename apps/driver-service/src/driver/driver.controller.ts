import { Controller } from '@nestjs/common';
import { DriverService } from './driver.service';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import {
  DRIVER_MESSAGE,
  DriverQuery,
  DriverStatus,
  UpdateLocationDto,
} from '@repo/shared';

@Controller('driver')
export class DriverController {
  constructor(private readonly driverService: DriverService) {}

  @EventPattern(DRIVER_MESSAGE.UPDATE_LOCATION)
  updateDriverLocation(
    @Payload() payload: { id: string; data: UpdateLocationDto },
  ) {
    return this.driverService.updateLocation(payload.id, payload.data);
  }

  @MessagePattern(DRIVER_MESSAGE.UPDATE_STATUS)
  async updateStatus(@Payload() data: { id: string; status: DriverStatus }) {
    const { id, status } = data;
    return await this.driverService.updateStatus(id, status);
  }

  @MessagePattern(DRIVER_MESSAGE.SEARCH_NEARBY)
  async searchNearbyDrivers(query: DriverQuery) {
    return await this.driverService.findNearbyDrivers(query);
  }

  @MessagePattern('get_all_locations')
  async getAllDrivers() {
    return await this.driverService.getAllLocation();
  }
}
