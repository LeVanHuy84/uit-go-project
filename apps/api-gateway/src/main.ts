import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  await app.listen(process.env.GATEWAY_PORT ?? 4000);
  console.log(`API Gateway is running on: ${await app.getUrl()}`);
}
bootstrap();
