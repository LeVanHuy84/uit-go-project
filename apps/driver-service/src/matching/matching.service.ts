import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type Redis from 'ioredis';
import type { ChannelWrapper } from 'amqp-connection-manager';
import { DriverQuery, DriverStatus, TripMatchingRequest } from '@repo/shared';

import { DriverLockService } from './driver-lock.service';
import { DriverService } from 'src/driver/driver.service';

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  private readonly TRIED_PREFIX = 'trip:tried:'; // set of driverIds tried for trip
  private readonly TRIED_TTL = 60 * 5; // 5 minutes

  private readonly LOCK_PREFIX = 'lock:driver:'; // lock:driver:{driverId} -> tripId
  private readonly LOCK_TTL = 15; // seconds

  private readonly TRIP_BY_DRIVER = 'trip:by-driver:'; // trip:by-driver:{driverId} = tripId
  private readonly TRIP_BY_DRIVER_TTL = 45; // seconds (shorter but > LOCK_TTL)

  private readonly TRIP_META = 'trip:meta:'; // trip:meta:{tripId} -> hset lat,lng,...
  private readonly TRIP_META_TTL = 60 * 5;

  private readonly RETRY_COUNT_PREFIX = 'trip:retry:';
  private readonly MAX_RETRY = 5;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    @Inject('RABBITMQ_CHANNEL') private readonly channel: ChannelWrapper,
    private readonly driverLockService: DriverLockService,
    private readonly driverService: DriverService,
  ) {}

  async handleTripRequested(trip: TripMatchingRequest) {
    const { id } = trip;
    await this.redis.set(
      `${this.TRIP_META}${id}`,
      JSON.stringify(trip),
      'EX',
      this.TRIP_META_TTL,
    );
    await this.redis.del(`${this.TRIED_PREFIX}${id}`);
    await this.redis.del(`${this.RETRY_COUNT_PREFIX}${id}`);
    await this.tryAssignDriver(id);
  }

  async tryAssignDriver(tripId: string): Promise<void> {
    const raw = await this.redis.get(`${this.TRIP_META}${tripId}`);
    if (!raw) return;
    const trip = JSON.parse(raw) as TripMatchingRequest;

    const triedKey = `${this.TRIED_PREFIX}${tripId}`;
    const triedDrivers = new Set<string>(
      (await this.redis.smembers(triedKey)) || [],
    );

    const query: DriverQuery = {
      lat: trip.originLat,
      lng: trip.originLng,
      vehicleType: trip.vehicleType,
    };

    const candidates = await this.driverLockService.findNearbyDrivers(query);

    if (!candidates.length) {
      await this.handleUnassignedTrip(tripId);
      return;
    }

    for (const d of candidates) {
      if (triedDrivers.has(d.id)) continue;

      const lockKey = `${this.LOCK_PREFIX}${d.id}`;
      // ioredis set returns "OK" when set, null otherwise
      const locked = await this.redis.set(
        lockKey,
        tripId,
        'EX',
        this.LOCK_TTL,
        'NX',
      );
      if (!locked) continue;

      // set trip by driver
      await this.redis.set(
        `${this.TRIP_BY_DRIVER}${d.id}`,
        tripId,
        'EX',
        this.TRIP_BY_DRIVER_TTL,
      );

      // mark tried
      await this.redis.sadd(triedKey, d.id);
      await this.redis.expire(triedKey, this.TRIED_TTL);

      // publish to notification exchange with driver-specific routing key
      await this.publishNotification(`driver.assigned`, {
        tripId,
        driverId: d.id,
        trip,
        expiresIn: this.LOCK_TTL,
      });

      return;
    }

    await this.handleUnassignedTrip(tripId);
  }

  private async handleUnassignedTrip(tripId: string) {
    const retryKey = `${this.RETRY_COUNT_PREFIX}${tripId}`;
    const count = await this.redis.incr(retryKey);
    await this.redis.expire(retryKey, this.TRIED_TTL);

    if (count > this.MAX_RETRY) {
      this.channel.publish('driver.events', 'driver.timeout', { tripId });
      return;
    }

    const delay = Math.min(50 * 2 ** count, 3000);
    setTimeout(() => this.tryAssignDriver(tripId), delay);
  }

  async onDriverTimeoutOrRejected(
    tripId: string,
    driverId: string,
    reason: 'timeout' | 'rejected',
  ) {
    await this.redis.del(`${this.LOCK_PREFIX}${driverId}`);
    await this.redis.del(`${this.TRIP_BY_DRIVER}${driverId}`);
    await this.redis.sadd(`${this.TRIED_PREFIX}${tripId}`, driverId);
    await this.redis.expire(`${this.TRIED_PREFIX}${tripId}`, this.TRIED_TTL);
    await this.tryAssignDriver(tripId);
  }

  async handleDriverRejected(driverId: string, tripId: string) {
    await this.onDriverTimeoutOrRejected(tripId, driverId, 'rejected');
    return { success: true };
  }

  async handleDriverAccepted(
    driverId: string,
    tripId: string,
  ): Promise<boolean> {
    const lockKey = `${this.LOCK_PREFIX}${driverId}`;
    const current = await this.redis.get(lockKey);
    const raw = await this.redis.get(`${this.TRIP_META}${tripId}`);
    if (current !== tripId || !raw) return false;

    const trip = JSON.parse(raw) as TripMatchingRequest;
    await this.redis.del(lockKey);
    await this.redis.del(`${this.TRIP_BY_DRIVER}${driverId}`);
    await this.redis.del(`${this.TRIED_PREFIX}${tripId}`);
    await this.redis.del(`${this.TRIP_META}${tripId}`);

    await this.driverService.updateStatus(driverId, DriverStatus.BUSY);

    this.channel.publish('driver.events', 'driver.accepted', {
      tripId,
      driverId,
    });
    return true;
  }

  async handleTripCancelled(tripId: string) {
    const triedKey = `${this.TRIED_PREFIX}${tripId}`;
    const retryKey = `${this.RETRY_COUNT_PREFIX}${tripId}`;
    const metaKey = `${this.TRIP_META}${tripId}`;

    const triedDrivers = (await this.redis.smembers(triedKey)) || [];
    if (triedDrivers.length > 0) {
      // Batch get lock values
      const pipeline = this.redis.pipeline();
      for (const driverId of triedDrivers) {
        pipeline.get(`${this.LOCK_PREFIX}${driverId}`);
      }
      const res = (await pipeline.exec()) as Array<[Error | null, any]>;
      const driversToClear: string[] = [];

      for (let i = 0; i < triedDrivers.length; i++) {
        const lockVal = res[i]?.[1] as string | null;
        if (lockVal === tripId) driversToClear.push(triedDrivers[i]);
      }

      if (driversToClear.length) {
        const delPipe = this.redis.pipeline();
        for (const driverId of driversToClear) {
          delPipe.del(`${this.LOCK_PREFIX}${driverId}`);
          delPipe.del(`${this.TRIP_BY_DRIVER}${driverId}`);
        }
        await delPipe.exec();
      }
    }

    await this.redis.del(triedKey, retryKey, metaKey);

    await this.publishNotification('trip.cancelled', { tripId });
  }

  private async publishNotification(routingKey: string, payload: any) {
    try {
      // ChannelWrapper.publish accepts (exchange, routingKey, content)
      this.channel.publish('notification', routingKey, payload);
    } catch (err) {
      this.logger.error('publishNotification failed', err as any);
    }
  }
}
