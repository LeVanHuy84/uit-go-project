import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trip } from './entities/trip.entity';
import {
  CreateTripDto,
  CreateTripRatingDto,
  TripMatchingRequest,
  TripRatingResponseDto,
  TripResponseDto,
  TripStatus,
} from '@repo/shared';
import { plainToInstance } from 'class-transformer';
import { TripRating } from './entities/trip-rating.entity';
import type { ChannelWrapper } from 'amqp-connection-manager';

@Injectable()
export class TripService {
  constructor(
    @InjectRepository(Trip)
    private tripRepo: Repository<Trip>,
    @InjectRepository(TripRating)
    private tripRatingRepo: Repository<TripRating>,
    @Inject('RABBITMQ_CHANNEL') private readonly channel: ChannelWrapper,
  ) {}
  async create(dto: CreateTripDto): Promise<TripResponseDto> {
    const estimatedFare = this.calculateEstimatedFare(
      dto.pickup.lat,
      dto.pickup.lng,
      dto.dropOff.lat,
      dto.dropOff.lng,
    );
    const trip = this.tripRepo.create({
      passengerId: dto.passengerId,
      vehicleType: dto.vehicleType,
      originLat: dto.pickup.lat,
      originLng: dto.pickup.lng,
      destinationLat: dto.dropOff.lat,
      destinationLng: dto.dropOff.lng,
      estimatedFare: estimatedFare,
      status: TripStatus.SEARCHING,
    });
    const saved = await this.tripRepo.save(trip);

    // 2️⃣ Publish sự kiện trip.requested
    await this.channel.publish(
      'trip.events',
      'trip.requested',
      this.toTripMatchingRequest(trip),
    );

    return plainToInstance(TripResponseDto, saved);
  }

  async findOne(id: string, userId: string): Promise<TripResponseDto> {
    const trip = await this.tripRepo.findOne({ where: { id } });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.passengerId !== userId && trip.driverId !== userId)
      throw new BadRequestException('Unauthorized access trip');

    return plainToInstance(TripResponseDto, trip);
  }

  async cancel(id: string, userId: string) {
    const trip = await this.tripRepo.findOne({ where: { id } });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.status === TripStatus.SEARCHING) {
      await this.channel.publish('trip.events', 'trip.cancel', trip.id);
      return { message: 'Trip cancelled successfully' };
    }
    if (
      trip.status === TripStatus.CANCELLED ||
      trip.status === TripStatus.COMPLETED
    )
      throw new BadRequestException('Trip already ended');

    // Only passenger or driver can cancel, add logic check if needed
    if (trip.passengerId !== userId && trip.driverId !== userId)
      throw new BadRequestException('Unauthorized cancel trip');
    trip.status = TripStatus.CANCELLED;
    await this.tripRepo.save(trip);
    return { message: 'Trip cancelled successfully' };
  }

  async acceptTrip(id: string, driverId: string) {
    const trip = await this.tripRepo.findOne({ where: { id } });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.status !== TripStatus.SEARCHING)
      throw new BadRequestException('Trip not available for accept');

    trip.status = TripStatus.ACCEPTED;
    trip.driverId = driverId;
    await this.tripRepo.save(trip);
    return { message: 'Trip accepted successfully' };
  }

  async completeTrip(id: string, driverId: string) {
    const trip = await this.tripRepo.findOne({ where: { id } });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.status !== TripStatus.ACCEPTED)
      throw new BadRequestException('Trip not in progress');
    if (trip.driverId !== driverId)
      throw new BadRequestException('Unauthorized driver');
    trip.status = TripStatus.COMPLETED;
    await this.tripRepo.save(trip);
    return { message: 'Trip completed successfully' };
  }

  async timeoutTrip(id: string) {
    const trip = await this.tripRepo.findOne({ where: { id } });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.status === TripStatus.SEARCHING) {
      trip.status = TripStatus.CANCELLED;
      const tripR = await this.tripRepo.save(trip);
    }
  }

  async ratingTrip(
    tripId: string,
    userId: string,
    dto: CreateTripRatingDto,
  ): Promise<TripRatingResponseDto> {
    const trip = await this.tripRepo.findOne({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');

    if (trip.passengerId !== userId)
      throw new BadRequestException('Only passenger can rate trip');

    if (trip.status !== TripStatus.COMPLETED)
      throw new BadRequestException('Cannot rate unfinished trip');

    // Check if already rated
    const existing = await this.tripRatingRepo.findOne({ where: { tripId } });
    if (existing) throw new BadRequestException('Trip already rated');

    const rating = this.tripRatingRepo.create({
      tripId,
      driverId: trip.driverId,
      passengerId: trip.passengerId,
      rating: dto.rating,
      feedback: dto.feedback,
    });
    const saved = await this.tripRatingRepo.save(rating);

    return plainToInstance(TripRatingResponseDto, saved);
  }

  private calculateEstimatedFare(
    originLat: number,
    originLng: number,
    destinationLat: number,
    destinationLng: number,
  ): number {
    // Placeholder logic for fare calculation
    const distance = Math.sqrt(
      Math.pow(destinationLat - originLat, 2) +
        Math.pow(destinationLng - originLng, 2),
    );
    const baseFare = 10000;
    const perKmRate = 5000;
    return baseFare + distance * perKmRate;
  }
  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) {
    const R = 6371; // Bán kính Trái Đất (km)
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // HELPER
  private toTripMatchingRequest(e: Trip): TripMatchingRequest {
    return {
      id: e.id,
      passengerId: e.passengerId,
      vehicleType: e.vehicleType,
      originLat: e.originLat,
      originLng: e.originLng,
      destinationLat: e.destinationLat,
      destinationLng: e.destinationLng,
      estimatedFare: e.estimatedFare,
      createdAt: e.createdAt,
    };
  }
}
