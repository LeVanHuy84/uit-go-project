import { InjectRedis } from '@nestjs-modules/ioredis';
import { Injectable } from '@nestjs/common';
import { DriverQuery, DriverStatus, UpdateLocationDto } from '@repo/shared';
import type { Redis } from 'ioredis';

@Injectable()
export class DriverService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async updateLocation(id: string, data: UpdateLocationDto): Promise<void> {
    const { lat, lng } = data;

    await this.redis.geoadd('geo:drivers', lng, lat, id);

    await this.redis.hset(`driver:${id}`, {
      lat: lat.toString(),
      lng: lng.toString(),
      updatedAt: Date.now().toString(),
    });
  }

  async updateStatus(id: string, status: DriverStatus) {
    const key = `status:${id}`;
    await this.redis.set(key, status, 'EX', 3600);
    return { success: true };
  }

  async findNearbyDrivers(
    query: DriverQuery,
  ): Promise<
    Array<{ id: string; distance: number; lat: number; lng: number }>
  > {
    const { lat, lng } = query;
    const desiredCount = 10;
    const maxRadiusKm = 10;

    // 1️⃣ Tìm tài xế gần nhất trong GEO
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
      desiredCount * 3, // overfetch để bù lọc status
      'ASC',
    )) as Array<[string, string, [string, string]]>;

    if (!raw?.length) return [];

    // 2️⃣ Lấy trạng thái từng tài xế
    const ids = raw.map(([id]) => id);
    const statuses = await this.redis.mget(...ids.map((id) => `status:${id}`));

    // 3️⃣ Lọc những tài xế đang ONLINE
    const drivers: Array<{
      id: string;
      distance: number;
      lat: number;
      lng: number;
    }> = [];

    raw.forEach(([id, distStr, [lngStr, latStr]], i) => {
      if (statuses[i] === DriverStatus.ONLINE) {
        drivers.push({
          id,
          distance: parseFloat(distStr),
          lat: parseFloat(latStr),
          lng: parseFloat(lngStr),
        });
      }
    });

    return drivers.slice(0, desiredCount);
  }

  // 🧩 DEBUG: lấy toàn bộ vị trí + trạng thái hiện có trong Redis GEO
  async getAllLocation(): Promise<
    Array<{ id: string; lat: number; lng: number; status: string | null }>
  > {
    const raw = (await this.redis.geosearch(
      'geo:drivers',
      'FROMLONLAT',
      0,
      0,
      'BYRADIUS',
      20000, // 20,000 km = toàn cầu
      'km',
      'WITHCOORD',
    )) as Array<[string, [string, string]]>;

    if (!raw || raw.length === 0) return [];

    const ids = raw.map(([id]) => id);
    const statuses = await this.redis.mget(...ids.map((id) => `status:${id}`));

    return raw.map(([id, [lng, lat]], i) => ({
      id,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      status: statuses[i] ?? null,
    }));
  }
}
