import { InjectRedis } from '@nestjs-modules/ioredis';
import { Injectable, Logger } from '@nestjs/common';
import {
  DriverQuery,
  DriverResponse,
  DriverStatus,
  UpdateLocationDto,
  VehicleType,
} from '@repo/shared';
import type { Redis } from 'ioredis';

@Injectable()
export class DriverLockService {
  private readonly logger = new Logger(DriverLockService.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async findNearbyDrivers(query: DriverQuery): Promise<DriverResponse[]> {
    const { lat, lng, vehicleType } = query;
    const desiredCount = 5;
    const maxRadiusKm = 5;

    try {
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
      )) as Array<[string, string, [string, string]]> | null;

      if (!raw?.length) return [];

      const ids = raw.map(([id]) => id);

      // Pipeline để lấy status, vehicleType và lock existence
      const pipeline = this.redis.pipeline();
      for (const id of ids) {
        pipeline.get(`status:${id}`); // driver status
        pipeline.hget(`driver:${id}`, 'vehicleType');
        pipeline.exists(`lock:driver:${id}`); // kiểm tra driver bị lock
      }

      const pipelineRes = (await pipeline.exec()) as
        | [Error | null, string | number | null][]
        | null;

      if (!pipelineRes) {
        this.logger.error('Redis pipeline returned null');
        return [];
      }

      const drivers: DriverResponse[] = [];

      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const distStr = raw[i][1];
        const [lngStr, latStr] = raw[i][2];

        // mỗi driver có 3 kết quả trong pipelineRes
        const status = pipelineRes[i * 3]?.[1] as string | null;
        const vehicle = pipelineRes[i * 3 + 1]?.[1] as string | null;
        const lockExists = (pipelineRes[i * 3 + 2]?.[1] as number) === 1;

        const isOnline = status === DriverStatus.ONLINE;
        const matchesVehicle =
          !vehicleType || (vehicle != null && vehicle === vehicleType);

        if (isOnline && matchesVehicle && !lockExists) {
          drivers.push({
            id,
            distance: parseFloat(distStr),
            lat: parseFloat(latStr),
            lng: parseFloat(lngStr),
            vehicleType: vehicle as VehicleType,
          });
        }
      }

      return drivers.slice(0, desiredCount);
    } catch (err) {
      this.logger.error('findNearbyDrivers failed', err as any);
      throw err;
    }
  }
}
