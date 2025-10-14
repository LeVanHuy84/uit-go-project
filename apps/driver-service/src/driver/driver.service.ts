import { InjectRedis } from '@nestjs-modules/ioredis';
import { Injectable, Logger } from '@nestjs/common';
import {
  DriverQuery,
  DriverStatus,
  UpdateLocationDto,
  VehicleType,
} from '@repo/shared';
import type { Redis } from 'ioredis';

@Injectable()
export class DriverService {
  private readonly logger = new Logger(DriverService.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async updateLocation(id: string, data: UpdateLocationDto): Promise<void> {
    const { lat, lng } = data;

    try {
      await this.redis.geoadd('geo:drivers', lng, lat, id);
      await this.redis.hset(`driver:${id}`, {
        lat: lat.toString(),
        lng: lng.toString(),
        updatedAt: Date.now().toString(),
      });

      // ⚙️ Refresh TTL nếu đang online
      const status = await this.redis.get(`status:${id}`);
      if (status) {
        await this.redis.expire(`status:${id}`, 120);
      }
    } catch (err) {
      this.logger.error(`updateLocation failed for ${id}`, err as any);
      throw err;
    }
  }

  /**
   * Cập nhật status và (tuỳ chọn) vehicleType.
   * Lưu ý: status giữ TTL; vehicleType được lưu trong hash driver:{id}
   */
  async updateStatus(
    id: string,
    status: DriverStatus,
    vehicleType?: VehicleType,
  ): Promise<{ success: boolean }> {
    try {
      const pipeline = this.redis.pipeline();

      // set status with TTL (2 minutes)
      pipeline.set(`status:${id}`, status, 'EX', 120);

      // update vehicleType in hash nếu có
      if (vehicleType) {
        pipeline.hset(`driver:${id}`, 'vehicleType', vehicleType);
      }

      await pipeline.exec();
      return { success: true };
    } catch (err) {
      this.logger.error(`updateStatus failed for ${id}`, err as any);
      throw err;
    }
  }

  /**
   * Tìm tài xế gần theo lat/lng, có thể filter theo vehicleType.
   * Trả về tối đa desiredCount.
   */
  async findNearbyDrivers(
    query: DriverQuery,
  ): Promise<
    Array<{ id: string; distance: number; lat: number; lng: number }>
  > {
    const { lat, lng, vehicleType } = query;
    const desiredCount = 10;
    const maxRadiusKm = 10;

    try {
      // 1) Lấy thô từ GEO (overfetch để bù lọc)
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

      // 2) Lấy status cho tất cả bằng MGET (1 round-trip)
      const statusKeys = ids.map((id) => `status:${id}`);
      const statuses = (await this.redis.mget(...statusKeys)) as Array<
        string | null
      >;

      // 3) Lấy vehicleType cho tất cả bằng pipeline (1 round-trip)
      const p = this.redis.pipeline();
      ids.forEach((id) => p.hget(`driver:${id}`, 'vehicleType'));
      const pipelineRes = (await p.exec()) as [Error | null, string | null][];
      const vehicleTypeData = pipelineRes.map(([, res]) => res);

      // 4) Filter và map kết quả
      const drivers: Array<{
        id: string;
        distance: number;
        lat: number;
        lng: number;
        vehicleType: string | null;
      }> = [];

      raw.forEach(([id, distStr, [lngStr, latStr]], i) => {
        const isOnline = statuses[i] === DriverStatus.ONLINE;
        const matchesVehicle =
          !vehicleType ||
          (vehicleTypeData[i] != null && vehicleTypeData[i] === vehicleType);

        if (isOnline && matchesVehicle) {
          drivers.push({
            id,
            distance: parseFloat(distStr),
            lat: parseFloat(latStr),
            lng: parseFloat(lngStr),
            vehicleType: vehicleTypeData[i] ?? null,
          });
        }
      });

      return drivers.slice(0, desiredCount);
    } catch (err) {
      this.logger.error('findNearbyDrivers failed', err as any);
      throw err;
    }
  }

  // DEBUG: lấy toàn bộ vị trí + trạng thái + vehicleType
  async getAllLocation(): Promise<
    Array<{
      id: string;
      lat: number;
      lng: number;
      status: string | null;
      vehicleType: string | null;
    }>
  > {
    try {
      const raw = (await this.redis.geosearch(
        'geo:drivers',
        'FROMLONLAT',
        0,
        0,
        'BYRADIUS',
        20000,
        'km',
        'WITHCOORD',
      )) as Array<[string, [string, string]]> | null;

      if (!raw || raw.length === 0) return [];

      const ids = raw.map(([id]) => id);
      const statuses = (await this.redis.mget(
        ...ids.map((id) => `status:${id}`),
      )) as Array<string | null>;

      // pipeline lấy vehicleType
      const p = this.redis.pipeline();
      ids.forEach((id) => p.hget(`driver:${id}`, 'vehicleType'));
      const pipelineRes = (await p.exec()) as [Error | null, string | null][];
      const vehicleTypes = pipelineRes.map(([, res]) => res);

      return raw.map(([id, [lng, lat]], i) => ({
        id,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        status: statuses[i] ?? null,
        vehicleType: vehicleTypes[i] ?? null,
      }));
    } catch (err) {
      this.logger.error('getAllLocation failed', err as any);
      throw err;
    }
  }
}
