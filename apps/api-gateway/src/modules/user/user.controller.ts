import { Controller, Post, Body, Get, Put, Req, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  CreateDriverProfileDto,
  CreateUserDto,
  SERVICE_NAME,
  UpdateUserDto,
  USER_MESSAGE,
} from '@repo/shared';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUserId } from 'src/common/decorators/current-user-id.decorator';

@Controller({
  version: '1',
  path: 'users',
})
export class UsersController {
  constructor(
    @Inject(SERVICE_NAME.USER_SERVICE) private userClient: ClientProxy,
  ) {}

  @Public()
  @Post()
  async register(@Body() dto: CreateUserDto) {
    return firstValueFrom(this.userClient.send(USER_MESSAGE.CREATE_USER, dto));
  }

  @Get('me')
  async me(@Req() req: any) {
    return firstValueFrom(
      this.userClient.send(USER_MESSAGE.GET_USER_BY_ID, req.user.userId),
    );
  }

  @Put('me')
  async updateMe(@Req() req: any, @Body() dto: UpdateUserDto) {
    return firstValueFrom(
      this.userClient.send(USER_MESSAGE.UPDATE_USER, {
        id: req.user.userId,
        dto,
      }),
    );
  }

  @Post('register-driver-profile')
  async registerDriverProfile(
    @Body() dto: CreateDriverProfileDto,
    @CurrentUserId() userId: string,
  ) {
    return firstValueFrom(
      this.userClient.send(USER_MESSAGE.REGISTER_DRIVER_PROFILE, {
        userId,
        dto,
      }),
    );
  }
}
