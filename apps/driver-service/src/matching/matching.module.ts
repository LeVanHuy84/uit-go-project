import { Module } from '@nestjs/common';
import { DriverConsumer } from './driver-consumer.service';
import { MatchingService } from './matching.service';
import { RedisExpirationListener } from './redis-expiration.listener';
import { DriverLockService } from './driver-lock.service';
import { MatchingController } from './matching.controller';
import { DriverService } from 'src/driver/driver.service';

@Module({
  imports: [],
  controllers: [MatchingController],
  providers: [
    DriverConsumer,
    MatchingService,
    RedisExpirationListener,
    DriverLockService,
    DriverService,
  ],
})
export class MatchingModule {}
