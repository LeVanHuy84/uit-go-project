import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'prisma/prisma.service';
import {
  CreateDriverProfileDto,
  CreateUserDto,
  UserRoleEnum,
} from '@repo/shared';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use');

    const hashed = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        fullName: dto.fullName,
        password: hashed,
        phone: dto.phone,
        role: this.mapToPrismaRole(dto.role ?? UserRoleEnum.PASSENGER),
      },
    });

    const { password, ...rest } = user as any;
    return rest;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const { password, ...rest } = user as any;
    return rest;
  }

  async updateProfile(id: string, payload: Partial<any>) {
    await this.prisma.user.update({ where: { id }, data: payload });
    return this.findById(id);
  }

  async registerDriverProfile(userId: string, dto: CreateDriverProfileDto) {
    // 1. Kiểm tra user có tồn tại không
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // 2. Kiểm tra đã có driver profile chưa
    const existing = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (existing) {
      throw new BadRequestException('Driver profile already exists');
    }

    // 3. Tạo mới driver profile
    const profile = await this.prisma.driverProfile.create({
      data: {
        userId,
        licenseNumber: dto.licenseNumber,
        vehicleType: dto.vehicleType,
        vehicleBrand: dto.vehicleBrand,
        vehicleModel: dto.vehicleModel,
        licensePlate: dto.licensePlate,
      },
      include: { user: true },
    });

    return profile;
  }

  private mapToPrismaRole = (role: UserRoleEnum): UserRole => {
    return role === UserRoleEnum.DRIVER ? UserRole.driver : UserRole.passenger;
  };
}
