import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Reflector } from '@nestjs/core'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

// Roles decorator
import { SetMetadata } from '@nestjs/common'
export const Roles = (...roles: string[]) => SetMetadata('roles', roles)

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>('roles', context.getHandler())
    if (!roles) return true
    const { user } = context.switchToHttp().getRequest()
    if (!roles.includes(user.role)) throw new ForbiddenException('Insufficient permissions')
    return true
  }
}
