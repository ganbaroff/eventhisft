import {
  Module, Controller, Get, Post, HttpCode, Param, Body,
  UseGuards, Request, Injectable, Query,
  BadRequestException, NotFoundException,
} from '@nestjs/common'
import { IsString, IsOptional } from 'class-validator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { PrismaService } from '../prisma/pg.service'

class CreateOperationDto {
  @IsString() shiftId: string
  @IsString() serviceId: string
  @IsOptional() @IsString() zoneId?: string
  @IsOptional() @IsString() notes?: string
}

@Injectable()
class OperationsService {
  constructor(private prisma: PrismaService) {}

  async list(shiftId: string, userId: string) {
    // Show only operations for this shift, scoped to user's assigned services
    const userServices = await this.prisma.userService.findMany({ where: { userId } })
    const serviceIds = userServices.map((us: any) => us.serviceId)

    return this.prisma.operation.findMany({
      where: { shiftId, serviceId: { in: serviceIds } },
      include: {
        service: { select: { id: true, name: true } },
        zone: { select: { id: true, name: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async create(dto: CreateOperationDto, userId: string) {
    // Validate shift is ACTIVE
    const shift = await this.prisma.shift.findUnique({ where: { id: dto.shiftId } })
    if (!shift) throw new NotFoundException('Shift not found')
    if (shift.status !== 'ACTIVE') throw new BadRequestException('Can only create operations on an active shift')

    return this.prisma.operation.create({
      data: {
        shiftId: dto.shiftId,
        serviceId: dto.serviceId,
        zoneId: dto.zoneId || null,
        notes: dto.notes,
        createdById: userId,
        status: 'DRAFT',
        syncState: 'SYNCED',
      },
    })
  }

  async submit(id: string, userId: string) {
    const op = await this.prisma.operation.findUnique({ where: { id } })
    if (!op) throw new NotFoundException()
    if (op.status !== 'DRAFT') throw new BadRequestException('Only DRAFT operations can be submitted')
    if (op.createdById !== userId) throw new BadRequestException('Can only submit your own operations')

    return this.prisma.operation.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date(), syncState: 'SYNCED' },
    })
  }
}

@Controller('operations')
@UseGuards(JwtAuthGuard)
class OperationsController {
  constructor(private svc: OperationsService) {}

  @Get()
  list(@Query('shiftId') shiftId: string, @Request() req: any) {
    return this.svc.list(shiftId, req.user.sub)
  }

  @Post()
  create(@Body() dto: CreateOperationDto, @Request() req: any) {
    return this.svc.create(dto, req.user.sub)
  }

  @HttpCode(200)
  @Post(':id/submit')
  submit(@Param('id') id: string, @Request() req: any) {
    return this.svc.submit(id, req.user.sub)
  }
}

@Module({
  controllers: [OperationsController],
  providers: [OperationsService],
})
export class OperationsModule {}
