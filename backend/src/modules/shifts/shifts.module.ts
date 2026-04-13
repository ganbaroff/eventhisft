import {
  Module, Controller, Get, Post, HttpCode, Param,
  UseGuards, Request, Injectable,
  BadRequestException, NotFoundException, ForbiddenException,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { PrismaService } from '../prisma/pg.service'

const MANAGER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SENIOR_MANAGER', 'SERVICE_MANAGER']

@Injectable()
class ShiftsService {
  constructor(private prisma: PrismaService) {}

  private async getProjectAndDept(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    const project = await this.prisma.project.findFirst({
      where: { organizationId: user!.organizationId, isActive: true },
    })
    const dept = project
      ? await this.prisma.department.findFirst({ where: { projectId: project.id, isActive: true } })
      : null
    return { project, dept }
  }

  async list(userId: string) {
    const { dept } = await this.getProjectAndDept(userId)
    if (!dept) return []
    return this.prisma.shift.findMany({
      where: { departmentId: dept.id },
      include: {
        openedBy: { select: { id: true, fullName: true } },
        closedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { startsAt: 'desc' },
    })
  }

  async getActive(userId: string) {
    const { dept } = await this.getProjectAndDept(userId)
    if (!dept) return null
    return this.prisma.shift.findFirst({
      where: { departmentId: dept.id, status: 'ACTIVE' },
      include: { openedBy: { select: { id: true, fullName: true } } },
    })
  }

  async open(shiftId: string, userId: string, role: string) {
    if (!MANAGER_ROLES.includes(role)) throw new ForbiddenException('Only managers can open shifts')
    const shift = await this.prisma.shift.findUnique({ where: { id: shiftId } })
    if (!shift) throw new NotFoundException()
    if (shift.status !== 'PLANNED') throw new BadRequestException('Only PLANNED shifts can be opened')

    // Check no other active shift in same dept
    const existing = await this.prisma.shift.findFirst({
      where: { departmentId: shift.departmentId, status: 'ACTIVE' },
    })
    if (existing) throw new BadRequestException('Another shift is already active for this department')

    return this.prisma.shift.update({
      where: { id: shiftId },
      data: { status: 'ACTIVE', openedById: userId, openedAt: new Date() },
    })
  }


  async handover(shiftId: string, userId: string, role: string) {
    if (!MANAGER_ROLES.includes(role)) throw new ForbiddenException('Only managers can initiate handover')
    const shift = await this.prisma.shift.findUnique({ where: { id: shiftId } })
    if (!shift) throw new NotFoundException()
    if (shift.status !== 'ACTIVE') throw new BadRequestException('Only ACTIVE shifts can be handed over')
    return this.prisma.shift.update({
      where: { id: shiftId },
      data: { status: 'HANDOVER' },
    })
  }

  async close(shiftId: string, userId: string, role: string) {
    if (!MANAGER_ROLES.includes(role)) throw new ForbiddenException('Only managers can close shifts')
    const shift = await this.prisma.shift.findUnique({ where: { id: shiftId } })
    if (!shift) throw new NotFoundException()
    if (shift.status === 'CLOSED') throw new BadRequestException('Shift already closed')

    // Lock all submitted operations
    await this.prisma.operation.updateMany({
      where: { shiftId, status: 'SUBMITTED' },
      data: { status: 'LOCKED', lockedAt: new Date() },
    })

    return this.prisma.shift.update({
      where: { id: shiftId },
      data: { status: 'CLOSED', closedById: userId, closedAt: new Date(), endsAt: new Date() },
    })
  }
}

@Controller('shifts')
@UseGuards(JwtAuthGuard)
class ShiftsController {
  constructor(private svc: ShiftsService) {}

  @Get()
  list(@Request() req: any) {
    return this.svc.list(req.user.sub)
  }

  @Get('active')
  getActive(@Request() req: any) {
    return this.svc.getActive(req.user.sub)
  }

  @HttpCode(200)
  @Post(':id/open')
  open(@Param('id') id: string, @Request() req: any) {
    return this.svc.open(id, req.user.sub, req.user.role)
  }

  @HttpCode(200)
  @Post(':id/handover')
  handover(@Param('id') id: string, @Request() req: any) {
    return this.svc.handover(id, req.user.sub, req.user.role)
  }

  @HttpCode(200)
  @Post(':id/close')
  close(@Param('id') id: string, @Request() req: any) {
    return this.svc.close(id, req.user.sub, req.user.role)
  }
}

@Module({
  controllers: [ShiftsController],
  providers: [ShiftsService],
})
export class ShiftsModule {}
