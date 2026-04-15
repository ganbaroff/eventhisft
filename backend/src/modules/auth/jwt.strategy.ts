import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/pg.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private prisma: PrismaService) {
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
    // Verify tokenVersion still matches — rejects access tokens issued before
    // a password rotation / forced logout.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, isActive: true, tokenVersion: true } as any,
    })
    if (!user || !(user as any).isActive) throw new UnauthorizedException()
    const currentTv = (user as any).tokenVersion ?? 0
    if ((payload.tv ?? 0) !== currentTv) {
      throw new UnauthorizedException('Token revoked')
    }
    return { sub: payload.sub, role: payload.role }
  }
}
