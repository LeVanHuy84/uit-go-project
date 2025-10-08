import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExceptionsFilter } from '@repo/shared';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const tcpApp = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: process.env.DRIVER_HOST ?? 'localhost',
        port: parseInt(process.env.DRIVER_PORT ?? '4003'),
      },
    },
  );

  tcpApp.useGlobalFilters(new ExceptionsFilter());

  await tcpApp.listen();
}
bootstrap();
