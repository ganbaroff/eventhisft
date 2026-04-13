import { Controller, Post, Get, Patch, Body, UseGuards, Request, BadRequestException } from '@nestjs/common'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { IsEmail, IsString } from 'class-validator'

class LoginDto {
  @IsEmail() email: string
  @IsString() password: string
}

class RefreshDto {
  @IsString() refreshToken: string
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password)
  }

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
  @Patch('password')
  async changePassword(
    @Request() req: any,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    if (!body.currentPassword || !body.newPassword) {
      throw new BadRequestException('currentPassword and newPassword are required')
    }
    if (body.newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters')
    }
    return this.authService.changePassword(req.user.sub, body.currentPassword, body.newPassword)
  }
}
