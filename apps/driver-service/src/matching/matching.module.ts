import { Module } from '@nestjs/common';
import { DriverConsumer } from './driver-consumer.service';
import { MatchingService } from './matching.service';
import { RedisExpirationListener } from './redis-expiration.listener';
import { DriverLockService } from './driver-lock.service';
import { MatchingController } from './matching.controller';

@Module({
  controllers: [MatchingController],
  providers: [
    DriverConsumer,
    MatchingService,
    RedisExpirationListener,
    DriverLockService,
  ],
})
export class MatchingModule {}
