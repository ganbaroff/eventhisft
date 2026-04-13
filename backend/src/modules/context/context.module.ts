import { Module, Controller, Get, UseGuards, Request, Injectable } from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { PrismaService } from '../prisma/pg.service'

@Injectable()
class ContextService {
  constructor(private prisma: PrismaService) {}

  async getContext(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, role: true, organizationId: true },
    })

    // Get the active project for this org (first active project)
    const project = await this.prisma.project.findFirst({
      where: { organizationId: user!.organizationId, isActive: true },
      select: { id: true, name: true },
    })

    // Get first active department for this project
    const department = project
      ? await this.prisma.department.findFirst({
          where: { projectId: project.id, isActive: true },
          select: { id: true, name: true },
        })
      : null

    // Get active shift for this department
    const activeShift = department
      ? await this.prisma.shift.findFirst({
          where: { departmentId: department.id, status: 'ACTIVE' },
          select: {
            id: true, name: true, status: true,
            startsAt: true, endsAt: true, openedAt: true,
            openedBy: { select: { id: true, fullName: true } },
          },
        })
      : null

    // Get assigned services for this user
    const userServices = await this.prisma.userService.findMany({
      where: { userId },
      include: { service: { select: { id: true, name: true, isActive: true } } },
    })
    const assignedServices = userServices
      .map((us: any) => us.service)
      .filter((s: any) => s.isActive)

    return {
      user: { id: user!.id, email: user!.email, fullName: user!.fullName, role: user!.role },
      project,
      department,
      activeShift,
      assignedServices,
    }
  }
}

@Controller('context')
class ContextController {
  constructor(private svc: ContextService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  get(@Request() req: any) {
    return this.svc.getContext(req.user.sub)
  }
}

@Module({
  controllers: [ContextController],
  providers: [ContextService],
})
export class ContextModule {}
