import {
  Controller,
  Post,
  Body,
  Inject,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AUTH_MESSAGE, LoginDto, SERVICE_NAME } from '@repo/shared';
import { firstValueFrom } from 'rxjs';
import { Public } from 'src/common/decorators/public.decorator';

@Controller({
  version: '1',
  path: 'sessions',
})
export class AuthController {
  constructor(
    @Inject(SERVICE_NAME.AUTH_SERVICE) private authClient: ClientProxy,
  ) {}

  @Public()
  @Post()
  async login(@Body() dto: LoginDto) {
    try {
      return await firstValueFrom(
        this.authClient.send(AUTH_MESSAGE.LOGIN, dto),
      );
    } catch (err: any) {
      const message = err?.message ?? err?.error ?? JSON.stringify(err);
      let status =
        err?.status ?? err?.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR;
      status = Number.isInteger(+status)
        ? +status
        : HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException(message, status);
    }
  }
}
