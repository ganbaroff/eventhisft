import { Controller, Post, Get, Patch, Body, UseGuards, Request } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { IsEmail, IsString, MinLength } from 'class-validator'

class LoginDto {
  @IsEmail() email: string
  @IsString() password: string
}

class RefreshDto {
  @IsString() refreshToken: string
}

class ChangePasswordDto {
  @IsString() currentPassword: string
  @IsString() @MinLength(8) newPassword: string
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password)
  }

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken)
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Request() req: any) {
    return this.authService.me(req.user.sub)
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Patch('password')
  async changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.sub, dto.currentPassword, dto.newPassword)
  }

  /**
   * Mint a short-lived SSE ticket (5 min, typ:'sse') so EventSource can
   * connect without putting a regular access token in the URL query.
   * Access token is required as usual in the Authorization header here —
   * only the ticket is allowed on the SSE URL.
   */
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post('sse-ticket')
  async sseTicket(@Request() req: any) {
    return this.authService.issueSseTicket(req.user.sub)
  }
}
