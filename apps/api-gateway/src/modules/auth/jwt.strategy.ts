import { Injectable, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ClientProxy } from '@nestjs/microservices';

const jwtSecret = process.env.JWT_SECRET || 'changeme_should_be_long_and_random';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject('AUTH_SERVICE') private authClient: ClientProxy) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: any) {
    return { 
      userId: payload.sub, 
      email: payload.username, 
      role: payload.role 
    };
  }
}