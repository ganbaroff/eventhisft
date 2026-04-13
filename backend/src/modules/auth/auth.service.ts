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

    return this.issueTokens(user.id, user.role)
  }

  async refresh(refreshToken: string) {
    try {
      const payload = jwt.verify(refreshToken, this.config.get('JWT_REFRESH_SECRET')!) as any
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } })
      if (!user || !user.isActive) throw new UnauthorizedException()
      return this.issueTokens(user.id, user.role)
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

  private issueTokens(userId: string, role: string) {
    const payload = { sub: userId, role }
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
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } })
    return { message: 'Password changed successfully' }
  }

}