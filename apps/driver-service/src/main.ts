import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExceptionsFilter } from '@repo/shared';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new ExceptionsFilter());

  await app.listen(process.env.PORT ?? 4003);
}
bootstrap();
