import { Module } from '@nestjs/common';
import { TripService } from './trip.service';
import { TripController } from './trip.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Trip } from './entities/trip.entity';
import { TripConsumer } from './consumer/trip-consumer.service';
import { TripRating } from './entities/trip-rating.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Trip, TripRating])],
  controllers: [TripController],
  providers: [TripService, TripConsumer],
})
export class TripModule {}
