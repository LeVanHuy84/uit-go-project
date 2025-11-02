import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { VersioningType } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    prefix: 'v',
  });

  await app.listen(process.env.GATEWAY_PORT ?? 4000);
  console.log(`API Gateway is running on: ${await app.getUrl()}`);
}
void bootstrap();
