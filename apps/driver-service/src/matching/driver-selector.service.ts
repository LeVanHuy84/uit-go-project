import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type Redis from 'ioredis';
import { DriverQuery } from '@repo/shared';

@Injectable()
export class DriverSelectorService {
  private readonly logger = new Logger(DriverSelectorService.name);

  private readonly LOCK_TTL = 15;
  private readonly TRIED_TTL = 300;

  constructor(@InjectRedis() private readonly redis: Redis) {}

  private readonly luaScript = `
    local lockKey = KEYS[1]
    local tripByDriverKey = KEYS[2]
    local triedKey = KEYS[3]

    local tripId = ARGV[1]
    local ttl = tonumber(ARGV[2])

    -- try acquire lock
    if redis.call("SET", lockKey, tripId, "NX", "EX", ttl) then
        -- set trip-by-driver
        redis.call("SET", tripByDriverKey, tripId, "EX", ttl)
        -- add to tried set
        redis.call("SADD", triedKey, KEYS[4])
        redis.call("EXPIRE", triedKey, ttl)
        return 1
    end
    return 0
  `;

  async pickDriver(
    tripId: string,
    candidates: string[],
  ): Promise<string | null> {
    for (const driverId of candidates) {
      const result = await this.redis.eval(
        this.luaScript,
        4,
        `lock:driver:${driverId}`,
        `trip:by-driver:${driverId}`,
        `trip:tried:${tripId}`,
        driverId,
        tripId,
        this.LOCK_TTL,
      );

      if (result === 1) return driverId;
    }

    return null;
  }
}
