import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  Put,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  USER_MESSAGE,
  CreateUserDto,
  UpdateUserDto,
  CreateDriverProfileDto,
} from '@repo/shared';

@Controller()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @MessagePattern(USER_MESSAGE.CREATE_USER)
  async createUser(@Payload() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @MessagePattern(USER_MESSAGE.GET_USER_BY_EMAIL)
  async findByEmail(@Payload() email: string) {
    return this.usersService.findByEmail(email);
  }

  @MessagePattern(USER_MESSAGE.GET_USER_BY_ID)
  async findById(@Payload() id: string) {
    return this.usersService.findById(id);
  }

  @MessagePattern(USER_MESSAGE.UPDATE_USER)
  async updateUser(@Payload() data: { id: string; dto: UpdateUserDto }) {
    return this.usersService.updateProfile(data.id, data.dto);
  }

  @MessagePattern(USER_MESSAGE.REGISTER_DRIVER_PROFILE)
  async registerDriverProfile(
    @Payload() data: { userId: string; dto: CreateDriverProfileDto },
  ) {
    return this.usersService.registerDriverProfile(data.userId, data.dto);
  }
}
