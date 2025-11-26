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
        await this.redis.expire(`status:${id}`, 300);
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

      // set status with TTL (5 minutes)
      pipeline.set(`status:${id}`, status, 'EX', 300);

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
  async findNearbyDrivers(query: DriverQuery): Promise<DriverResponse[]> {
    const { lat, lng, vehicleType } = query;
    const desiredCount = 15;
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
      const statusKeys = ids.map((id) => `status:${id}`);
      const statuses = (await this.redis.mget(...statusKeys)) as Array<
        string | null
      >;

      const p = this.redis.pipeline();
      ids.forEach((id) => p.hget(`driver:${id}`, 'vehicleType'));
      const pipelineRes = (await p.exec()) as [Error | null, string | null][];
      const vehicleTypeData = pipelineRes.map(([, res]) => res);

      const drivers: DriverResponse[] = [];

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
            vehicleType: vehicleTypeData[i] as VehicleType,
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
  async getAllLocation(): Promise<DriverResponse[]> {
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

      if (!raw?.length) return [];

      const ids = raw.map(([id]) => id);

      const p = this.redis.pipeline();
      ids.forEach((id) => p.hget(`driver:${id}`, 'vehicleType'));
      const pipelineRes = (await p.exec()) as [Error | null, string | null][];
      const vehicleTypes = pipelineRes.map(([, res]) => res);

      const results: DriverResponse[] = raw.map(([id, [lng, lat]], i) => ({
        id,
        distance: 0, // không có dữ liệu khoảng cách nên mặc định 0
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        vehicleType: vehicleTypes[i] as VehicleType,
      }));

      return results;
    } catch (err) {
      this.logger.error('getAllLocation failed', err as any);
      throw err;
    }
  }
}
