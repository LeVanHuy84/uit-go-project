import { Test, TestingModule } from '@nestjs/testing';
import { TripService } from './trip.service';
import { Repository } from 'typeorm';
import { Trip } from './entities/trip.entity';
import { TripRating } from './entities/trip-rating.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TripStatus, VehicleType } from '@repo/shared';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('TripService', () => {
  let service: TripService;
  let tripRepo: jest.Mocked<Repository<Trip>>;
  let ratingRepo: jest.Mocked<Repository<TripRating>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripService,
        {
          provide: getRepositoryToken(Trip),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(TripRating),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TripService>(TripService);
    tripRepo = module.get(getRepositoryToken(Trip));
    ratingRepo = module.get(getRepositoryToken(TripRating));
  });

  afterEach(() => jest.clearAllMocks());

  describe('create()', () => {
    it('should create and save a trip', async () => {
      const dto = {
        passengerId: 'p1',
        vehicleType: VehicleType.MOTORBIKE,
        pickup: { lat: 10, lng: 20 },
        dropOff: { lat: 11, lng: 21 },
      };
      const createdTrip = { id: 't1', ...dto, status: TripStatus.SEARCHING };
      tripRepo.create.mockReturnValue(createdTrip as any);
      tripRepo.save.mockResolvedValue(createdTrip as any);

      const result = await service.create(dto as any);

      expect(tripRepo.create).toHaveBeenCalled();
      expect(tripRepo.save).toHaveBeenCalled();
      expect(result).toMatchObject({ id: 't1', status: TripStatus.SEARCHING });
    });
  });

  describe('findOne()', () => {
    it('should return trip if user is authorized', async () => {
      const trip = { id: 't1', passengerId: 'u1' };
      tripRepo.findOne.mockResolvedValue(trip as any);

      const result = await service.findOne('t1', 'u1');
      expect(result.id).toBe('t1');
    });

    it('should throw NotFoundException if trip not found', async () => {
      tripRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('t1', 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if unauthorized', async () => {
      tripRepo.findOne.mockResolvedValue({
        id: 't1',
        passengerId: 'p1',
      } as any);
      await expect(service.findOne('t1', 'u2')).rejects.toThrow(
        BadRequestException
        ,
      );
    });
  });

  describe('cancel()', () => {
    it('should cancel trip if authorized', async () => {
      const trip = {
        id: 't1',
        passengerId: 'u1',
        status: TripStatus.SEARCHING,
      };
      tripRepo.findOne.mockResolvedValue(trip as any);
      tripRepo.save.mockResolvedValue({
        ...trip,
        status: TripStatus.CANCELLED,
      } as any);

      const result = await service.cancel('t1', 'u1');
      expect(result.message).toBe('Trip cancelled successfully');
    });

    it('should throw error if already completed', async () => {
      tripRepo.findOne.mockResolvedValue({
        status: TripStatus.COMPLETED,
      } as any);
      await expect(service.cancel('t1', 'u1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('acceptTrip()', () => {
    it('should accept trip if searching', async () => {
      const trip = { id: 't1', status: TripStatus.SEARCHING };
      tripRepo.findOne.mockResolvedValue(trip as any);
      tripRepo.save.mockResolvedValue({
        ...trip,
        status: TripStatus.ACCEPTED,
      } as any);

      const result = await service.acceptTrip('t1', 'd1');
      expect(result.message).toBe('Trip accepted successfully');
    });

    it('should throw if not searching', async () => {
      tripRepo.findOne.mockResolvedValue({
        status: TripStatus.COMPLETED,
      } as any);
      await expect(service.acceptTrip('t1', 'd1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('completeTrip()', () => {
    it('should complete trip if driver matches', async () => {
      const trip = { id: 't1', driverId: 'd1', status: TripStatus.ACCEPTED };
      tripRepo.findOne.mockResolvedValue(trip as any);
      tripRepo.save.mockResolvedValue({
        ...trip,
        status: TripStatus.COMPLETED,
      } as any);

      const result = await service.completeTrip('t1', 'd1');
      expect(result.message).toBe('Trip completed successfully');
    });

    it('should throw if unauthorized driver', async () => {
      const trip = { id: 't1', driverId: 'd2', status: TripStatus.ACCEPTED };
      tripRepo.findOne.mockResolvedValue(trip as any);
      await expect(service.completeTrip('t1', 'd1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('ratingTrip()', () => {
    it('should create trip rating if valid', async () => {
      const trip = {
        id: 't1',
        driverId: 'd1',
        passengerId: 'u1',
        status: TripStatus.COMPLETED,
      };
      tripRepo.findOne.mockResolvedValue(trip as any);
      ratingRepo.findOne.mockResolvedValue(null);
      ratingRepo.create.mockReturnValue({ id: 'r1' } as any);
      ratingRepo.save.mockResolvedValue({ id: 'r1' } as any);

      const dto = { rating: 5, feedback: 'Good' };
      const result = await service.ratingTrip('t1', 'u1', dto as any);

      expect(result).toMatchObject({ id: 'r1' });
    });

    it('should throw if already rated', async () => {
      tripRepo.findOne.mockResolvedValue({
        id: 't1',
        passengerId: 'u1',
        status: TripStatus.COMPLETED,
      } as any);
      ratingRepo.findOne.mockResolvedValue({ id: 'r1' } as any);

      await expect(
        service.ratingTrip('t1', 'u1', { rating: 4 } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
