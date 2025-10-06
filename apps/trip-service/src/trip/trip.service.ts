import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Trip } from './entities/trip.entity';
import { Repository } from 'typeorm';
import { CreateTripDto, TripResponseDto, TripStatus } from '@repo/share-dto';
import { plainToInstance } from 'class-transformer';



@Injectable()
export class TripService {
  constructor(@InjectRepository(Trip) private repo: Repository<Trip>) {}
  async createTrip(data: CreateTripDto ) {
    const trip = this.repo.create({
  
    });
    const entity = await this.repo.save(trip);
    return plainToInstance(TripResponseDto, entity, {});
  }

  async getTrip(id: string): Promise<TripResponseDto> {
    const trip = await this.repo.findOne({ where: { id } });
    if (!trip) throw new NotFoundException(`Trip ${id} not found`);
     return plainToInstance(TripResponseDto, trip, {});
  }

  async cancelTrip(id: string) {
    const trip = await this.getTrip(id);
    if ([TripStatus.COMPLETED, TripStatus.CANCELLED].includes(trip.status)) {
      throw new BadRequestException('Trip cannot be cancelled');
    }
    trip.status = TripStatus.CANCELLED;
    const cancelledTrip = await this.repo.save(trip);
     return plainToInstance(TripResponseDto, cancelledTrip, {});
  }
}
