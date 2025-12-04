// ==========================
// file: driver-lock.service.ts
// ==========================
import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type Redis from 'ioredis';
import { DriverQuery, DriverResponse, VehicleType } from '@repo/shared';
import { registerRedisScripts } from './redis-scripts';

@Injectable()
export class DriverLockService {
  private readonly logger = new Logger(DriverLockService.name);
  private readonly GEO_KEY = 'geo:drivers';
  private readonly STATUS_PREFIX = 'status:'; // status:{driverId}
  private readonly DRIVER_HASH = 'driver:'; // driver:{id} HASH
  private readonly LOCK_PREFIX = 'lock:driver:'; // lock:driver:{id}

  constructor(@InjectRedis() private readonly redis: Redis) {
    try {
      registerRedisScripts(this.redis);
    } catch (e) {
      // defineCommand may be called multiple times in tests - ignore
    }
  }

  /**
   * Sử dụng Lua script server-side để GEOSEARCH + kiểm tra status/vehicle/lock
   * Trả về tối đa `desiredCount` driver đã lọc sẵn.
   */
  async findNearbyDrivers(query: DriverQuery): Promise<DriverResponse[]> {
    const { lat, lng, vehicleType } = query;
    const desiredCount = 5;
    const maxRadiusKm = 5; // same as before

    try {
      // call the custom Lua script
      // ARGV: lon, lat, radiusKm, maxCandidates, desiredCount, vehicleTypeOrEmpty, geoKey, statusPrefix, driverHashPrefix, lockPrefix
      const maxCandidates = desiredCount * 3;
      const vehicleArg = vehicleType ?? '';

      // @ts-ignore - ioredis dyn command
      const raw: string[] = (await (this.redis as any).findNearbyDrivers(
        [],
        lng,
        lat,
        String(maxRadiusKm),
        String(maxCandidates),
        String(desiredCount),
        vehicleArg,
        this.GEO_KEY,
        this.STATUS_PREFIX,
        this.DRIVER_HASH,
        this.LOCK_PREFIX,
      )) as string[];

      if (!raw || raw.length === 0) return [];

      const drivers: DriverResponse[] = [];
      for (let i = 0; i < raw.length; i += 5) {
        const id = raw[i];
        const dist = parseFloat(raw[i + 1] ?? '0');
        const lonVal = parseFloat(raw[i + 2] ?? '0');
        const latVal = parseFloat(raw[i + 3] ?? '0');
        const vehicle = raw[i + 4] || undefined;

        drivers.push({
          id,
          distance: dist,
          lat: latVal,
          lng: lonVal,
          vehicleType: (vehicle as VehicleType) || undefined,
        });

        if (drivers.length >= desiredCount) break;
      }

      return drivers;
    } catch (err) {
      this.logger.error('findNearbyDrivers failed', err as any);
      throw err;
    }
  }

  /**
   * Thử lấy lock một cách atomic bằng Lua script (SET NX + set trip mapping)
   * Trả về true nếu lock thành công, false nếu driver đã bị lock.
   */
  async tryAcquireDriverLock(
    driverId: string,
    tripId: string,
    lockTtl = 15,
    tripByDriverTtl = 45,
  ): Promise<boolean> {
    const lockKey = `${this.LOCK_PREFIX}${driverId}`;
    const tripByDriverKey = `trip:by-driver:${driverId}`;

    try {
      // @ts-ignore
      const res: number = await (this.redis as any).acquireDriverLock(
        [lockKey, tripByDriverKey],
        tripId,
        String(lockTtl),
        String(tripByDriverTtl),
      );

      return res === 1;
    } catch (err) {
      this.logger.error('tryAcquireDriverLock failed', err as any);
      throw err;
    }
  }
}
