import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcryptjs'
import * as jwt from 'jsonwebtoken'
import { PrismaService } from '../prisma/pg.service'

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials')

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) throw new UnauthorizedException('Invalid credentials')

    return this.issueTokens(user.id, user.role, (user as any).tokenVersion ?? 0)
  }

  async refresh(refreshToken: string) {
    try {
      const payload = jwt.verify(refreshToken, this.config.get('JWT_REFRESH_SECRET')!) as any
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } })
      if (!user || !user.isActive) throw new UnauthorizedException()
      // tokenVersion gate: rotated password → bumped version → old refresh rejected.
      const currentTv = (user as any).tokenVersion ?? 0
      if ((payload.tv ?? 0) !== currentTv) {
        throw new UnauthorizedException('Refresh token revoked')
      }
      return this.issueTokens(user.id, user.role, currentTv)
    } catch {
      throw new UnauthorizedException('Invalid refresh token')
    }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, role: true, isActive: true },
    })
    if (!user) throw new UnauthorizedException()
    return user
  }

  /** Returns current tokenVersion for a user (used by JwtStrategy to validate access tokens). */
  async getTokenVersion(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true, tokenVersion: true } as any,
    })
    if (!user || !user.isActive) throw new UnauthorizedException()
    return (user as any).tokenVersion ?? 0
  }

  /**
   * Short-lived ticket token for EventSource /sse/now (5 min TTL, typ:'sse').
   * EventSource can't set Authorization header, so we pass the token in the
   * URL query string. A regular access token in a URL would leak into
   * Railway edge logs, Referer headers, and browser history for up to the
   * access TTL (15 min). A dedicated ticket limits that exposure to 5 min
   * and to SSE routes only — JwtStrategy rejects typ:'sse' anywhere else.
   */
  async issueSseTicket(userId: string): Promise<{ ticket: string }> {
    const tv = await this.getTokenVersion(userId)
    const ticket = jwt.sign(
      { sub: userId, typ: 'sse', tv },
      this.config.get('JWT_SECRET')!,
      { expiresIn: '5m' },
    )
    return { ticket }
  }

  private issueTokens(userId: string, role: string, tokenVersion: number) {
    const payload = { sub: userId, role, tv: tokenVersion }
    const accessToken = this.jwtService.sign(payload)
    const refreshToken = jwt.sign(payload, this.config.get('JWT_REFRESH_SECRET')!, { expiresIn: '7d' })
    return { accessToken, refreshToken }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new UnauthorizedException('User not found')

    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) throw new UnauthorizedException('Current password is incorrect')

    const hash = await bcrypt.hash(newPassword, 10)
    const newTv = ((user as any).tokenVersion ?? 0) + 1
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash, tokenVersion: newTv } as any,
    })
    // Return fresh tokens so the caller's session survives the rotation.
    return {
      message: 'Password changed successfully',
      ...this.issueTokens(user.id, user.role, newTv),
    }
  }

}