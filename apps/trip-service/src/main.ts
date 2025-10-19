import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP, // TCP
      options: {
        host: process.env.TRIP_SERVICE_HOST || 'localhost',
        port: parseInt(process.env.TRIP_SERVICE_PORT ?? '4002'),
      },
    },
  );
  await app.listen();
}
void bootstrap();
