  import { Module } from '@nestjs/common';
  import { ConfigModule, ConfigService } from '@nestjs/config';
  import { TypeOrmModule } from '@nestjs/typeorm';
  import { TripModule } from './trip/trip.module';
  import path from 'path';
  import { RabbitmqModule } from '@repo/shared';

  @Module({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, expandVariables: true }),
      TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          type: 'postgres',
          url: configService.get<string>('TRIP_DATABASE_URL'),
          entities: [path.resolve(__dirname, '.') + '/**/*.entity{.js,.ts}'],
          synchronize: true,
          ssl: {
            rejectUnauthorized: false,
          },
        }),
      }),
      RabbitmqModule.register({
        urls: ['amqp://guest:guest@localhost:5672'],
        exchanges: [
          { name: 'trip.events', type: 'topic' },
          { name: 'driver.events', type: 'topic' },
        ],
      }),
      TripModule,
    ],
  })
  export class AppModule {}
