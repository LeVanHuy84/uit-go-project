import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthController } from './auth.controller';
import { SERVICE_NAME } from '@repo/shared';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtCacheService } from './jwt-cache.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '1h') as any,
        },
      }),
    }),
    ClientsModule.registerAsync([
      {
        name: SERVICE_NAME.USER_SERVICE,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('USER_SERVICE_HOST'),
            port: config.get<number>('USER_SERVICE_PORT'),
          },
        }),
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [JwtCacheService],
  exports: [JwtCacheService],
})
export class AuthModule {}
