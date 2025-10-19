import { Module } from '@nestjs/common';
import { TripController } from './trip.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { SERVICE_NAME } from '@repo/shared';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
      ClientsModule.registerAsync([
        {
          name: SERVICE_NAME.TRIP_SERVICE,
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            transport: Transport.TCP,
            options: {
              port: config.get<number>('TRIP_SERVICE_PORT'),
            },
          }),
        },
      ]),
    ],
  controllers: [TripController]
})
export class TripModule {}
