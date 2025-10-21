import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
// import dbConfig from './config/db.config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverModule } from './driver/driver.module';
import { RedisModule } from '@nestjs-modules/ioredis';
import { RabbitmqModule } from '@repo/shared';
import { MatchingModule } from './matching/matching.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      // load: [dbConfig],
    }),
    // TypeOrmModule.forRootAsync({
    //   useFactory: dbConfig,
    // }),
    RedisModule.forRoot({
      type: 'single',
      options: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
          ? parseInt(process.env.REDIS_PORT, 10)
          : 6379,
      },
    }),
    RabbitmqModule.register({
      urls: ['amqp://guest:guest@localhost:5672'],
      exchanges: [
        { name: 'trip.events', type: 'topic' },
        { name: 'driver.events', type: 'topic' },
        { name: 'notification', type: 'fanout' },
      ],
    }),
    DriverModule,
    MatchingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
