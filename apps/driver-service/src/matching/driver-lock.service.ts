import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type Redis from 'ioredis';
import {
  DriverQuery,
  DriverResponse,
  DriverStatus,
  VehicleType,
} from '@repo/shared';

@Injectable()
export class DriverLockService {
  private readonly logger = new Logger(DriverLockService.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * tìm các driver gần đó và filter theo status/vehicle/lock
   * trả về tối đa `desiredCount` kết quả đã lọc sẵn
   */
  async findNearbyDrivers(query: DriverQuery): Promise<DriverResponse[]> {
    const { lat, lng, vehicleType } = query;
    const desiredCount = 5;
    const maxRadiusKm = 5;

    try {
      // GEOSEARCH trả về mảng [member, dist, [lon, lat]] (hoặc tương tự) — cast to any[] để xử lý
      const raw = (await this.redis.geosearch(
        'geo:drivers',
        'FROMLONLAT',
        lng,
        lat,
        'BYRADIUS',
        maxRadiusKm,
        'km',
        'WITHDIST',
        'WITHCOORD',
        'COUNT',
        desiredCount * 3,
        'ASC',
      )) as any[] | null;

      if (!raw?.length) return [];

      const ids: string[] = raw.map((r) => String(r[0]));

      // Pipeline: get status, vehicleType, exists(lock)
      const pipeline = this.redis.pipeline();
      for (const id of ids) {
        pipeline.get(`status:${id}`); // driver status
        pipeline.hget(`driver:${id}`, 'vehicleType'); // stored vehicle type
        pipeline.exists(`lock:driver:${id}`); // lock tồn tại?
      }

      const pipelineRes = (await pipeline.exec()) as Array<[Error | null, any]>;

      if (!pipelineRes) {
        this.logger.error('Redis pipeline returned null');
        return [];
      }

      const drivers: DriverResponse[] = [];

      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const distStr = raw[i][1];
        const coord = raw[i][2] as [string, string];

        // pipelineRes hàng theo thứ tự push -> 3 entries mỗi id
        const status = pipelineRes[i * 3]?.[1] as string | null;
        const vehicle = pipelineRes[i * 3 + 1]?.[1] as string | null;
        const lockExists = Number(pipelineRes[i * 3 + 2]?.[1]) === 1;

        const isOnline = status === DriverStatus.ONLINE;
        const matchesVehicle =
          !vehicleType || (vehicle != null && vehicle === vehicleType);

        if (isOnline && matchesVehicle && !lockExists) {
          drivers.push({
            id,
            distance: parseFloat(String(distStr)),
            lat: parseFloat(String(coord[1])),
            lng: parseFloat(String(coord[0])),
            vehicleType: (vehicle as VehicleType) || undefined,
          });
        }

        // Stop early when we gathered enough
        if (drivers.length >= desiredCount) break;
      }

      return drivers;
    } catch (err) {
      this.logger.error('findNearbyDrivers failed', err as any);
      throw err;
    }
  }
}
