import { Test, TestingModule } from '@nestjs/testing';
import { DriverService } from './driver.service';
import { DriverStatus, VehicleType } from '@repo/shared';
import type { Redis } from 'ioredis';

describe('DriverService', () => {
  let service: DriverService;
  let redisMock: jest.Mocked<Redis>;

  beforeEach(async () => {
    jest.clearAllMocks();

    // default pipeline mock
    const defaultPipeline = {
      set: jest.fn().mockReturnThis(),
      hset: jest.fn().mockReturnThis(),
      hget: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };

    redisMock = {
      geoadd: jest.fn().mockResolvedValue(1),
      geosearch: jest.fn().mockResolvedValue(null),
      hset: jest.fn().mockResolvedValue(1),
      hget: jest.fn().mockResolvedValue(null),
      mget: jest.fn().mockResolvedValue([]),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      expire: jest.fn().mockResolvedValue(1),
      pipeline: jest.fn().mockReturnValue(defaultPipeline),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriverService,
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: redisMock,
        },
      ],
    }).compile();

    service = module.get<DriverService>(DriverService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should update location and refresh TTL when online', async () => {
    redisMock.geoadd.mockResolvedValueOnce(1 as any);
    redisMock.hset.mockResolvedValueOnce(1 as any);
    redisMock.get.mockResolvedValueOnce(DriverStatus.ONLINE);
    redisMock.expire.mockResolvedValueOnce(1);

    await service.updateLocation('d1', { lat: 10, lng: 20 });

    expect(redisMock.geoadd).toHaveBeenCalledWith('geo:drivers', 20, 10, 'd1');
    expect(redisMock.hset).toHaveBeenCalledWith(
      'driver:d1',
      expect.any(Object),
    );
    expect(redisMock.expire).toHaveBeenCalledWith('status:d1', 120);
  });

  it('should update location but skip TTL refresh if offline', async () => {
    redisMock.get.mockResolvedValueOnce(null);
    await service.updateLocation('d2', { lat: 11, lng: 21 });

    expect(redisMock.expire).not.toHaveBeenCalled();
  });

  it('should update status and vehicle type', async () => {
    const fakePipeline = {
      set: jest.fn().mockReturnThis(),
      hset: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    redisMock.pipeline.mockReturnValue(fakePipeline as any);

    const res = await service.updateStatus(
      'd3',
      DriverStatus.ONLINE,
      VehicleType.CAR_4_SEATS,
    );

    expect(fakePipeline.set).toHaveBeenCalledWith(
      `status:d3`,
      DriverStatus.ONLINE,
      'EX',
      120,
    );
    expect(fakePipeline.hset).toHaveBeenCalledWith(
      `driver:d3`,
      'vehicleType',
      VehicleType.CAR_4_SEATS,
    );
    expect(fakePipeline.exec).toHaveBeenCalled();
    expect(res).toEqual({ success: true });
  });

  it('should find nearby online drivers with correct vehicleType', async () => {
    redisMock.geosearch.mockResolvedValueOnce([
      ['d1', '0.5', ['20.0', '10.0']],
      ['d2', '1.0', ['20.1', '10.1']],
      ['d3', '2.0', ['20.2', '10.2']],
    ] as any);

    redisMock.mget.mockResolvedValueOnce([
      DriverStatus.ONLINE,
      DriverStatus.OFFLINE,
      DriverStatus.ONLINE,
    ]);

    const pipelineExecResult: [Error | null, string | null][] = [
      [null, VehicleType.CAR_4_SEATS],
      [null, VehicleType.MOTORBIKE],
      [null, VehicleType.CAR_4_SEATS],
    ];
    const fakePipeline = {
      hget: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(pipelineExecResult),
    };
    redisMock.pipeline.mockReturnValue(fakePipeline as any);

    const res = await service.findNearbyDrivers({
      lat: 10,
      lng: 20,
      vehicleType: VehicleType.CAR_4_SEATS,
    });

    // d1 & d3 thỏa mãn => 2 kết quả
    expect(res.length).toBe(2);
    expect(res.map((d) => d.id)).toEqual(['d1', 'd3']);
    expect(res[0]).toMatchObject({
      id: 'd1',
      distance: 0.5,
      lat: 10,
      lng: 20,
      vehicleType: VehicleType.CAR_4_SEATS,
    });
  });

  it('should get all driver locations with vehicleType', async () => {
    redisMock.geosearch.mockResolvedValueOnce([
      ['d1', ['20.0', '10.0']],
      ['d2', ['21.0', '11.0']],
    ] as any);

    const fakePipeline = {
      hget: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        [null, VehicleType.CAR_4_SEATS],
        [null, VehicleType.MOTORBIKE],
      ]),
    };
    redisMock.pipeline.mockReturnValue(fakePipeline as any);

    const res = await service.getAllLocation();

    expect(res).toHaveLength(2);
    expect(res[0]).toEqual(
      expect.objectContaining({
        id: 'd1',
        lat: 10,
        lng: 20,
        vehicleType: VehicleType.CAR_4_SEATS,
        distance: 0,
      }),
    );
  });

  // Uncomment nếu muốn test lỗi Redis
  // it('should log and throw if redis.geoadd fails', async () => {
  //   redisMock.geoadd.mockRejectedValueOnce(new Error('Redis down'));
  //   await expect(
  //     service.updateLocation('d1', { lat: 10, lng: 20 }),
  //   ).rejects.toThrow('Redis down');
  // });
});
