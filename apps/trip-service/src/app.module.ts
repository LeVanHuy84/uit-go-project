import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripModule } from './trip/trip.module';
import path from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, expandVariables: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        entities: [path.resolve(__dirname, '.') + '/**/*.entity{.js,.ts}'],
        synchronize: true,
        ssl: {
          rejectUnauthorized: false,
        }
      }),
    }),
    TripModule,
  ],
})
export class AppModule {}
