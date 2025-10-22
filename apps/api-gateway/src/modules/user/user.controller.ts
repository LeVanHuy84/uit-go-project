import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Put, 
  UseGuards, 
  Req, 
  Inject 
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { firstValueFrom } from 'rxjs';
import { CreateUserDto, SERVICE_NAME, UpdateUserDto, USER_MESSAGE } from '@repo/shared';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('users')
export class UsersController {
  constructor(@Inject(SERVICE_NAME.USER_SERVICE) private userClient: ClientProxy) {}

  @Public()
  @Post()
  async register(@Body() dto: CreateUserDto) {
    return firstValueFrom(
      this.userClient.send(USER_MESSAGE.CREATE_USER, dto)
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: any) {
    return firstValueFrom(
      this.userClient.send(USER_MESSAGE.GET_USER_BY_ID, req.user.userId)
    );
  }

  @UseGuards(JwtAuthGuard)
  @Put('me')
  async updateMe(@Req() req: any, @Body() dto: UpdateUserDto) {
    return firstValueFrom(
      this.userClient.send(
        USER_MESSAGE.UPDATE_USER,
        { id: req.user.userId, dto }
      )
    );
  }
}