import * as bcrypt from 'bcryptjs'
import {
  Module, Controller, Get, Post, Patch, Param, Body,
  UseGuards, Request, Injectable, ForbiddenException,
} from '@nestjs/common'
import { IsString, IsBoolean, IsOptional, MinLength } from 'class-validator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { PrismaService } from '../prisma/pg.service'

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SENIOR_MANAGER']


class CreateUserDto {
  @IsString() fullName: string
  @IsString() email: string
  @IsString() @MinLength(6) password: string
  @IsString() role: string
}

class PatchUserDto {
  @IsBoolean() isActive: boolean
}

class CreateZoneDto {
  @IsString() name: string
  @IsOptional() @IsString() description?: string
}

class PatchZoneDto {
  @IsOptional() @IsString() name?: string
  @IsOptional() @IsBoolean() isActive?: boolean
}

class CreateServiceDto {
  @IsString() name: string
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsString() departmentId?: string
}


class SetUserServicesDto {
  @IsString({ each: true })
  serviceIds: string[]
}

class CreateShiftAdminDto {
  @IsString() name: string
  @IsString() startsAt: string
}

class PatchServiceDto {
  @IsOptional() @IsString() name?: string
  @IsOptional() @IsBoolean() isActive?: boolean
}

@Injectable()
class AdminService {
  constructor(private prisma: PrismaService) {}

  private async requireAdmin(userId: string, role: string) {
    if (!ADMIN_ROLES.includes(role)) throw new ForbiddenException('Admin access required')
    return this.prisma.user.findUnique({ where: { id: userId } })
  }

  // ── Users ────────────────────────────────────────────────────────────────
  async listUsers(userId: string, role: string) {
    const admin = await this.requireAdmin(userId, role)
    return this.prisma.user.findMany({
      where: { organizationId: admin!.organizationId },
      select: { id: true, email: true, fullName: true, role: true, isActive: true },
      orderBy: { fullName: 'asc' },
    })
  }

  async createUser(dto: CreateUserDto, actorId: string, role: string) {
    const admin = await this.requireAdmin(actorId, role)
    const passwordHash = await bcrypt.hash(dto.password, 10)
    return this.prisma.user.create({
      data: {
        organizationId: admin!.organizationId,
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        role: dto.role as any,
        isActive: true,
      },
      select: { id: true, email: true, fullName: true, role: true, isActive: true },
    })
  }

  async setUserActive(targetId: string, isActive: boolean, actorId: string, role: string) {
    await this.requireAdmin(actorId, role)
    return this.prisma.user.update({
      where: { id: targetId },
      data: { isActive },
      select: { id: true, email: true, fullName: true, role: true, isActive: true },
    })
  }

  // ── Zones ────────────────────────────────────────────────────────────────
  async listZones(userId: string, role: string) {
    const admin = await this.requireAdmin(userId, role)
    const project = await this.prisma.project.findFirst({
      where: { organizationId: admin!.organizationId, isActive: true },
    })
    return this.prisma.zone.findMany({
      where: { projectId: project?.id ?? '' },
      orderBy: { name: 'asc' },
    })
  }

  async createZone(dto: CreateZoneDto, userId: string, role: string) {
    const admin = await this.requireAdmin(userId, role)
    const project = await this.prisma.project.findFirst({
      where: { organizationId: admin!.organizationId, isActive: true },
    })
    return this.prisma.zone.create({
      data: { projectId: project!.id, name: dto.name, description: dto.description },
    })
  }

  async updateZone(id: string, dto: PatchZoneDto, userId: string, role: string) {
    await this.requireAdmin(userId, role)
    return this.prisma.zone.update({ where: { id }, data: dto })
  }

  // ── Services ─────────────────────────────────────────────────────────────
  async listServices(userId: string, role: string) {
    const admin = await this.requireAdmin(userId, role)
    const project = await this.prisma.project.findFirst({
      where: { organizationId: admin!.organizationId, isActive: true },
    })
    const departments = await this.prisma.department.findMany({
      where: { projectId: project?.id ?? '' },
    })
    const deptIds = departments.map((d: any) => d.id)
    return this.prisma.service.findMany({
      where: { departmentId: { in: deptIds } },
      orderBy: { name: 'asc' },
    })
  }

  async createService(dto: CreateServiceDto, userId: string, role: string) {
    await this.requireAdmin(userId, role)
    let deptId = dto.departmentId
    if (!deptId) {
      // Auto-resolve from user's project
      const user = await this.prisma.user.findUnique({ where: { id: userId } })
      const project = await this.prisma.project.findFirst({ where: { organizationId: user?.organizationId, isActive: true } })
      const dept = await this.prisma.department.findFirst({ where: { projectId: project?.id, isActive: true } })
      if (!dept) throw new Error('No active department found')
      deptId = dept.id
    }
    return this.prisma.service.create({
      data: { departmentId: deptId, name: dto.name, description: dto.description },
    })
  }

  async updateService(id: string, dto: PatchServiceDto, userId: string, role: string) {
    await this.requireAdmin(userId, role)
    return this.prisma.service.update({ where: { id }, data: dto })
  }

  // ── Shifts ───────────────────────────────────────────────────────────────

  // ── User-Service assignments ──────────────────────────────────────────────
  async getUserServices(userId: string, actorId: string, role: string) {
    await this.requireAdmin(actorId, role)
    const rows = await (this.prisma as any).query(
      `SELECT us."serviceId", s.name, s."isActive"
       FROM "UserService" us JOIN "Service" s ON s.id=us."serviceId"
       WHERE us."userId"=$1`,
      [userId]
    )
    return rows
  }

  async setUserServices(targetUserId: string, serviceIds: string[], actorId: string, role: string) {
    await this.requireAdmin(actorId, role)
    // Delete existing and re-insert — simple replace strategy
    await (this.prisma as any).execute('DELETE FROM "UserService" WHERE "userId"=$1', [targetUserId])
    for (const sid of serviceIds) {
      await (this.prisma as any).execute(
        'INSERT INTO "UserService"("userId","serviceId") VALUES($1,$2) ON CONFLICT DO NOTHING',
        [targetUserId, sid]
      )
    }
    return { userId: targetUserId, serviceIds }
  }

  async createShift(dto: { name: string; startsAt: string }, userId: string, role: string) {
    const admin = await this.requireAdmin(userId, role)
    const project = await this.prisma.project.findFirst({
      where: { organizationId: admin!.organizationId, isActive: true },
    })
    const dept = project
      ? await this.prisma.department.findFirst({ where: { projectId: project.id, isActive: true } })
      : null
    if (!project || !dept) throw new Error('No active project or department found')
    return this.prisma.shift.create({
      data: {
        projectId: project.id,
        departmentId: dept.id,
        name: dto.name,
        status: 'PLANNED',
        startsAt: new Date(dto.startsAt),
      },
    })
  }
}

@Controller('admin')
@UseGuards(JwtAuthGuard)
class AdminController {
  constructor(private svc: AdminService) {}

  @Get('users')
  listUsers(@Request() req: any) {
    return this.svc.listUsers(req.user.sub, req.user.role)
  }

  @Post('users')
  createUser(@Body() dto: CreateUserDto, @Request() req: any) {
    return this.svc.createUser(dto, req.user.sub, req.user.role)
  }

  @Patch('users/:id')
  setUserActive(@Param('id') id: string, @Body() dto: PatchUserDto, @Request() req: any) {
    return this.svc.setUserActive(id, dto.isActive, req.user.sub, req.user.role)
  }

  @Get('zones')
  listZones(@Request() req: any) {
    return this.svc.listZones(req.user.sub, req.user.role)
  }

  @Post('zones')
  createZone(@Body() dto: CreateZoneDto, @Request() req: any) {
    return this.svc.createZone(dto, req.user.sub, req.user.role)
  }

  @Patch('zones/:id')
  updateZone(@Param('id') id: string, @Body() dto: PatchZoneDto, @Request() req: any) {
    return this.svc.updateZone(id, dto, req.user.sub, req.user.role)
  }

  @Get('services')
  listServices(@Request() req: any) {
    return this.svc.listServices(req.user.sub, req.user.role)
  }

  @Post('services')
  createService(@Body() dto: CreateServiceDto, @Request() req: any) {
    return this.svc.createService(dto, req.user.sub, req.user.role)
  }

  @Patch('services/:id')
  updateService(@Param('id') id: string, @Body() dto: PatchServiceDto, @Request() req: any) {
    return this.svc.updateService(id, dto, req.user.sub, req.user.role)
  }

  @Post('shifts')
  createShift(@Body() dto: CreateShiftAdminDto, @Request() req: any) {
    return this.svc.createShift(dto, req.user.sub, req.user.role)
  }

  @Get('users/:id/services')
  getUserServices(@Param('id') id: string, @Request() req: any) {
    return this.svc.getUserServices(id, req.user.sub, req.user.role)
  }

  @Post('users/:id/services')
  setUserServices(@Param('id') id: string, @Body() dto: SetUserServicesDto, @Request() req: any) {
    return this.svc.setUserServices(id, dto.serviceIds, req.user.sub, req.user.role)
  }
}

@Module({
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
