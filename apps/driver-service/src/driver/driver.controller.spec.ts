import { Test, TestingModule } from '@nestjs/testing';
import { DriverController } from './driver.controller';
import { DriverService } from './driver.service';
import {
  DriverStatus,
  VehicleType,
  DRIVER_MESSAGE,
  DriverQuery,
} from '@repo/shared';

describe('DriverController', () => {
  let controller: DriverController;
  let service: DriverService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DriverController],
      providers: [
        {
          provide: DriverService,
          useValue: {
            updateLocation: jest.fn(),
            updateStatus: jest.fn(),
            findNearbyDrivers: jest.fn(),
            getAllLocation: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<DriverController>(DriverController);
    service = module.get<DriverService>(DriverService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call service.updateLocation correctly', async () => {
    const payload = { id: 'd1', data: { lat: 10, lng: 20 } };
    (service.updateLocation as jest.Mock).mockResolvedValueOnce(undefined);

    await controller.updateDriverLocation(payload);

    expect(service.updateLocation).toHaveBeenCalledWith('d1', {
      lat: 10,
      lng: 20,
    });
  });

  it('should call service.updateStatus correctly', async () => {
    const payload = {
      id: 'd2',
      data: {
        status: DriverStatus.ONLINE,
        vehicleType: VehicleType.CAR_4_SEATS,
      },
    };
    (service.updateStatus as jest.Mock).mockResolvedValueOnce({
      success: true,
    });

    const res = await controller.updateStatus(payload);

    expect(service.updateStatus).toHaveBeenCalledWith(
      'd2',
      DriverStatus.ONLINE,
      VehicleType.CAR_4_SEATS,
    );
    expect(res).toEqual({ success: true });
  });

  it('should call service.findNearbyDrivers correctly', async () => {
    const query: DriverQuery = {
      lat: 10,
      lng: 20,
      vehicleType: VehicleType.CAR_4_SEATS,
    };
    const expectedDrivers = [{ id: 'd1', lat: 10, lng: 20, distance: 0.5 }];
    (service.findNearbyDrivers as jest.Mock).mockResolvedValueOnce(
      expectedDrivers,
    );

    const res = await controller.searchNearbyDrivers(query);

    expect(service.findNearbyDrivers).toHaveBeenCalledWith(query);
    expect(res).toEqual(expectedDrivers);
  });

  it('should call service.getAllLocation correctly', async () => {
    const expected = [
      {
        id: 'd1',
        lat: 10,
        lng: 20,
        status: DriverStatus.ONLINE,
        vehicleType: VehicleType.CAR_4_SEATS,
      },
    ];
    (service.getAllLocation as jest.Mock).mockResolvedValueOnce(expected);

    const res = await controller.getAllDrivers();

    expect(service.getAllLocation).toHaveBeenCalled();
    expect(res).toEqual(expected);
  });
});
