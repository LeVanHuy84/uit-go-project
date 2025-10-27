import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { SERVICE_NAME } from '@repo/shared';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersController } from './user.controller';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: SERVICE_NAME.USER_SERVICE,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            port: config.get<number>('USER_SERVICE_PORT'),
          },
        }),
      },
    ]),
  ],
  controllers: [UsersController],
})
export class UserModule {}
