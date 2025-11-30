import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class JwtCacheService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private getCacheKey(token: string) {
    return `jwt:${token}`;
  }

  async decodeWithCache(token: string) {
    const key = this.getCacheKey(token);

    // Try cache
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    // Decode + verify
    const decoded = this.jwtService.verify(token);

    // Cache TTL (same as token TTL)
    const ttl = decoded.exp
      ? decoded.exp - Math.floor(Date.now() / 1000)
      : 3600;
    if (ttl > 0) {
      await this.redis.set(key, JSON.stringify(decoded), 'EX', ttl);
    }

    return decoded;
  }
}
