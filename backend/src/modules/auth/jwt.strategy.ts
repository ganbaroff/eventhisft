import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: any) => req?.query?.token ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET'),
    })
  }

  async validate(payload: any) {
    return { sub: payload.sub, role: payload.role }
  }
}
