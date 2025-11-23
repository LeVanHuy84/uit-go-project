import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.createMicroservice(AppModule, {
    transport: Transport.TCP,
    options: {
      host: process.env.AUTH_HOST ?? 'localhost',
      port: parseInt(process.env.AUTH_PORT ?? '4004'),
    },
    logger: false,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  await app.listen();
  console.log('Auth microservice listening on TCP port 4004');
}

bootstrap();
