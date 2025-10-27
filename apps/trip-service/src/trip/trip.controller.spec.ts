import { Test, TestingModule } from '@nestjs/testing';

import { TripService } from './trip.service';
import { TripController } from './trip.controller';

describe('TripController', () => {
  let controller: TripController;
  let service: TripService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TripController],
      providers: [
        {
          provide: TripService,
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
            cancel: jest.fn(),
            acceptTrip: jest.fn(),
            completeTrip: jest.fn(),
            ratingTrip: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TripController>(TripController);
    service = module.get<TripService>(TripService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should call tripService.create with dto', async () => {
      const dto = { passengerId: 'p1' } as any;
      (service.create as jest.Mock).mockResolvedValue({ id: 't1' });

      const result = await controller.create({ dto });
      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 't1' });
    });
  });

  describe('findOne', () => {
    it('should call tripService.findOne with id and userId', async () => {
      (service.findOne as jest.Mock).mockResolvedValue({ id: 't1' });
      const data = { id: 't1', userId: 'u1' };

      const result = await controller.findOne(data);

      expect(service.findOne).toHaveBeenCalledWith('t1', 'u1');
      expect(result).toEqual({ id: 't1' });
    });
  });

  describe('cancel', () => {
    it('should call tripService.cancel', async () => {
      (service.cancel as jest.Mock).mockResolvedValue({ message: 'Trip cancelled' });
      const data = { id: 't1', userId: 'u1' };

      const result = await controller.cancel(data);
      expect(service.cancel).toHaveBeenCalledWith('t1', 'u1');
      expect(result).toEqual({ message: 'Trip cancelled' });
    });
  });

  describe('acceptTrip', () => {
    it('should call tripService.acceptTrip', async () => {
      (service.acceptTrip as jest.Mock).mockResolvedValue({ message: 'accepted' });
      const data = { id: 't1', driverId: 'd1' };

      const result = await controller.acceptTrip(data);
      expect(service.acceptTrip).toHaveBeenCalledWith('t1', 'd1');
      expect(result).toEqual({ message: 'accepted' });
    });
  });

  describe('completeTrip', () => {
    it('should call tripService.completeTrip', async () => {
      (service.completeTrip as jest.Mock).mockResolvedValue({ message: 'completed' });
      const data = { id: 't1', driverId: 'd1' };

      const result = await controller.completeTrip(data);
      expect(service.completeTrip).toHaveBeenCalledWith('t1', 'd1');
      expect(result).toEqual({ message: 'completed' });
    });
  });

  describe('ratingTrip', () => {
    it('should call tripService.ratingTrip with correct args', async () => {
      const dto = { rating: 5, feedback: 'great' };
      (service.ratingTrip as jest.Mock).mockResolvedValue({ id: 'r1' });
      const data = { tripId: 't1', userId: 'u1', dto };

      const result = await controller.ratingTrip(data);

      expect(service.ratingTrip).toHaveBeenCalledWith('t1', 'u1', dto);
      expect(result).toEqual({ id: 'r1' });
    });
  });
});