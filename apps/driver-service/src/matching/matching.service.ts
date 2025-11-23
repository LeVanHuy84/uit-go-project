import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
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

  /**
   * Entry: nhận trip.requested
   */
  async handleTripRequested(trip: TripMatchingRequest) {
    const { id } = trip;
    this.logger.log(`handleTripRequested: ${id}`);

    // Cache trip meta
    await this.redis.set(
      `${this.TRIP_META}${id}`,
      JSON.stringify(trip),
      'EX',
      this.TRIP_META_TTL,
    );

    // Reset tried set & retry counter
    await this.redis.del(`${this.TRIED_PREFIX}${id}`);
    await this.redis.del(`${this.RETRY_COUNT_PREFIX}${id}`);

    // Try assign first time
    await this.tryAssignDriver(id);
  }

  /**
   * Core: assign driver by querying geo dynamically.
   */
  async tryAssignDriver(tripId: string): Promise<void> {
    const raw = await this.redis.get(`${this.TRIP_META}${tripId}`);
    if (!raw) {
      this.logger.warn(`No trip meta found for ${tripId}`);
      return;
    }
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
      this.logger.warn(`No nearby drivers found for trip ${tripId}`);
      await this.handleUnassignedTrip(tripId);
      return;
    }

    for (const d of candidates) {
      if (triedDrivers.has(d.id)) continue;

      const lockKey = `${this.LOCK_PREFIX}${d.id}`;
      const locked = await this.redis.set(
        lockKey,
        tripId,
        'EX',
        this.LOCK_TTL,
        'NX',
      );
      if (!locked) continue;

      await this.redis.set(
        `${this.TRIP_BY_DRIVER}${d.id}`,
        tripId,
        'EX',
        this.TRIP_BY_DRIVER_TTL,
      );

      await this.redis.sadd(triedKey, d.id);
      await this.redis.expire(triedKey, this.TRIED_TTL);

      await this.publishNotification('driver.assigned', {
        tripId,
        driverId: d.id,
        trip,
        expiresIn: this.LOCK_TTL,
      });

      this.logger.log(
        `Assigned trip ${tripId} -> driver ${d.id} (lock TTL ${this.LOCK_TTL}s)`,
      );
      return;
    }

    this.logger.warn(
      `All current nearby drivers unavailable for trip ${tripId}`,
    );
    await this.handleUnassignedTrip(tripId);
  }

  /**
   * Retry limit handler for unassigned trips.
   */
  private async handleUnassignedTrip(tripId: string) {
    const retryKey = `${this.RETRY_COUNT_PREFIX}${tripId}`;
    const count = await this.redis.incr(retryKey);
    await this.redis.expire(retryKey, this.TRIED_TTL);

    if (count > this.MAX_RETRY) {
      this.logger.warn(`Trip ${tripId} exceeded max retry (${this.MAX_RETRY})`);
      this.channel.publish('driver.events', 'driver.timeout', { tripId });
      await this.publishNotification('trip.failed', { tripId });
      return;
    }

    // Optionally, small delay before retry to avoid spamming
    setTimeout(() => this.tryAssignDriver(tripId), 1000 * count);
  }

  async onDriverTimeoutOrRejected(
    tripId: string,
    driverId: string,
    reason: 'timeout' | 'rejected',
  ) {
    this.logger.warn(
      `onDriverTimeoutOrRejected: trip=${tripId} driver=${driverId} reason=${reason}`,
    );

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

  async handleDriverAccepted(driverId: string, tripId: string) {
    const lockKey = `${this.LOCK_PREFIX}${driverId}`;
    const current = await this.redis.get(lockKey);
    if (current !== tripId) {
      return { success: false };
    }

    const raw = await this.redis.get(`${this.TRIP_META}${tripId}`);
    if (!raw) {
      this.logger.warn(`No trip meta found for ${tripId}`);
      return;
    }
    const trip = JSON.parse(raw) as TripMatchingRequest;
    const { passengerId } = trip;

    await this.redis.del(lockKey);
    await this.redis.del(`${this.TRIP_BY_DRIVER}${driverId}`);
    await this.redis.del(`${this.TRIED_PREFIX}${tripId}`);
    await this.redis.del(`${this.TRIP_META}${tripId}`);

    // ✅ Đổi status tài xế thành BUSY (tránh match chuyến khác)
    await this.driverService.updateStatus(driverId, DriverStatus.BUSY);

    this.channel.publish('driver.events', 'driver.accepted', {
      tripId,
      driverId,
    });
    await this.publishNotification('driver.accepted', {
      tripId,
      driverId,
      passengerId,
    });
    this.logger.log(`Driver ${driverId} accepted trip ${tripId}`);
    return { success: true };
  }

  async handleTripCancelled(tripId: string) {
    this.logger.warn(`handleTripCancelled: trip=${tripId}`);

    // Xoá toàn bộ cache liên quan đến trip
    const triedKey = `${this.TRIED_PREFIX}${tripId}`;
    const retryKey = `${this.RETRY_COUNT_PREFIX}${tripId}`;
    const metaKey = `${this.TRIP_META}${tripId}`;

    // Xoá các driver đang bị lock cho trip này
    const triedDrivers = await this.redis.smembers(triedKey);
    for (const driverId of triedDrivers) {
      const lockKey = `${this.LOCK_PREFIX}${driverId}`;
      const tripByDriverKey = `${this.TRIP_BY_DRIVER}${driverId}`;

      const lockedTrip = await this.redis.get(lockKey);
      if (lockedTrip === tripId) {
        await this.redis.del(lockKey);
        await this.redis.del(tripByDriverKey);
        this.logger.debug(`Cleared lock & cache for driver=${driverId}`);
      }
    }

    // Xoá các key liên quan đến trip
    await this.redis.del(triedKey, retryKey, metaKey);

    // Gửi thông báo để driver app huỷ tìm kiếm nếu đang hiển thị popup
    await this.publishNotification('trip.cancelled', { tripId });

    this.logger.log(`Trip ${tripId} cancelled and caches cleared`);
  }

  private async publishNotification(routingKey: string, payload: any) {
    try {
      this.channel.publish('notification', routingKey, payload);
      this.logger.log(`Published ${routingKey}`);
    } catch (err) {
      this.logger.error('publishNotification failed', err as any);
    }
  }
}
