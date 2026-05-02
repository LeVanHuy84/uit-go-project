import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthService } from './auth.service';
import { AUTH_MESSAGE, LoginDto } from '@repo/shared';

@Controller()
export class AuthController {
  constructor(private authService: AuthService) {}

  @MessagePattern(AUTH_MESSAGE.LOGIN)
  async login(@Payload() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @MessagePattern(AUTH_MESSAGE.VALIDATE_TOKEN)
  async validateToken(@Payload() token: string) {
    return this.authService.validateToken(token);
  }
}
