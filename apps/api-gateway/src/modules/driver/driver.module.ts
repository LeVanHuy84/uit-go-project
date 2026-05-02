import { Module } from '@nestjs/common';
import { DriverController } from './driver.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { SERVICE_NAME } from '@repo/shared';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: SERVICE_NAME.DRIVER_SERVICE,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('DRIVER_SERVICE_HOST'),
            port: config.get<number>('DRIVER_SERVICE_PORT'),
          },
        }),
      },
    ]),
  ],
  controllers: [DriverController],
})
export class DriverModule {}
