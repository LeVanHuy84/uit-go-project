import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripModule } from './trip/trip.module';
import path from 'path';
import { RabbitmqModule } from '@repo/shared';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('TRIP_DATABASE_URL'),
        entities: [path.resolve(__dirname, '.') + '/**/*.entity{.js,.ts}'],
        synchronize: true,
      }),
    }),
    RabbitmqModule.register({
      urls: [
        `amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASS}@${process.env.RABBITMQ_HOST}:${process.env.RABBITMQ_PORT}`,
      ],
      exchanges: [
        { name: 'trip.events', type: 'topic' },
        { name: 'driver.events', type: 'topic' },
        { name: 'notification', type: 'topic' },
      ],
    }),
    TripModule,
  ],
})
export class AppModule {}
