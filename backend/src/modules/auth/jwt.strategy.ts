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
      passReqToCallback: true,
    } as any)
  }

  async validate(req: any, payload: any) {
    // Figure out where the token came from:
    //   - Authorization: Bearer ... → a regular access token (no typ field)
    //   - ?token=... in URL           → should be an SSE ticket (typ='sse')
    const fromQuery = !!(req?.query?.token && !req?.headers?.authorization)
    const isSseTicket = payload?.typ === 'sse'

    if (fromQuery && !isSseTicket) {
      // Regular access tokens must NEVER be accepted from the URL — they'd
      // leak into logs and Referer. Ticket-only for query-string auth.
      throw new UnauthorizedException('Regular access tokens cannot be used in URL')
    }
    if (!fromQuery && isSseTicket) {
      // SSE tickets are scoped to EventSource and must not authorize general
      // API calls via Authorization header.
      throw new UnauthorizedException('SSE ticket cannot be used on this route')
    }
    // Further: SSE tickets are only valid on the /sse/* routes.
    const path: string = req?.url || req?.originalUrl || ''
    if (isSseTicket && !path.startsWith('/sse/')) {
      throw new UnauthorizedException('SSE ticket scope is /sse/ only')
    }

    // Verify tokenVersion still matches — rejects tokens issued before
    // a password rotation / forced logout.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        isActive: true,
        tokenVersion: true,
        role: true,
        mustChangePassword: true,
      } as any,
    })
    if (!user || !(user as any).isActive) throw new UnauthorizedException()
    const currentTv = (user as any).tokenVersion ?? 0
    if ((payload.tv ?? 0) !== currentTv) {
      throw new UnauthorizedException('Token revoked')
    }

    // Forced password rotation gate for seeded accounts. Until the user
    // changes their password, only a narrow allow-list of endpoints responds.
    // The frontend reads mustChangePassword from /auth/me and presents a
    // modal that cannot be dismissed until PATCH /auth/password succeeds.
    //
    // Exact path matching (not startsWith). startsWith would let a path
    // like /auth/melicious through because it "starts with" /auth/me.
    // We strip trailing query string before comparing.
    if ((user as any).mustChangePassword) {
      const bare = path.split('?')[0].replace(/\/+$/, '')
      const allow = new Set([
        '/auth/me',
        '/auth/password',
        '/auth/logout',
        '/auth/sse-ticket',
      ])
      if (!allow.has(bare)) {
        throw new UnauthorizedException('Password rotation required')
      }
    }

    return { sub: payload.sub, role: payload.role ?? (user as any).role }
  }
}
