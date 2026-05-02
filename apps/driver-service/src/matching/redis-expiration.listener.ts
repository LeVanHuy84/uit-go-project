import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { MatchingService } from './matching.service';

@Injectable()
export class RedisExpirationListener implements OnModuleInit {
  private readonly logger = new Logger(RedisExpirationListener.name);
  private subscriber: Redis;

  // channel format: __keyevent@<db>__:expired
  private readonly EXPIRED_CHANNEL = '__keyevent@0__:expired';
  private readonly LOCK_PREFIX = 'lock:driver:'; // match expired keys starting with this
  private readonly TRIP_BY_DRIVER = 'trip:by-driver:'; // to lookup tripId

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly matchingService: MatchingService,
  ) {}

  async onModuleInit() {
    // create dedicated subscriber connection
    this.subscriber = this.redis.duplicate();

    // subscribe to Redis keyevent expired channel
    await this.subscriber.subscribe(this.EXPIRED_CHANNEL);
    this.subscriber.on('message', async (channel: string, message: string) => {
      try {
        if (channel !== this.EXPIRED_CHANNEL) return;

        // message is the expired key name
        const key = message;

        if (key.startsWith(this.LOCK_PREFIX)) {
          // key format: lock:driver:{driverId}
          const driverId = key.substring(this.LOCK_PREFIX.length);
          // find tripId from trip:by-driver:{driverId}
          const tripId = await this.redis.get(
            `${this.TRIP_BY_DRIVER}${driverId}`,
          );
          if (!tripId) {
            // this.logger.debug(
            //   `Expired lock ${key} but no trip mapping found (maybe cleaned).`,
            // );
            return;
          }

          // this.logger.warn(
          //   `Lock expired for driver ${driverId} (trip ${tripId}) -> retrying matching`,
          // );
          // inform matching service: driver timed out for this trip
          await this.matchingService.onDriverTimeoutOrRejected(
            tripId,
            driverId,
            'timeout',
          );
        }
      } catch (err) {
        //this.logger.error('Error handling expired key message', err as any);
      }
    });

    this.logger.log(
      'Subscribed to Redis expired events on channel ' + this.EXPIRED_CHANNEL,
    );
  }
}
