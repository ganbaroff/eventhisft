import { assertTransition } from './incident-state-machine'
import {
  Module, Controller, Get, Post, HttpCode, Param, Body,
  UseGuards, Request, Injectable, Query,
  BadRequestException, NotFoundException, ForbiddenException,
} from '@nestjs/common'
import { IsString, IsEnum, IsOptional } from 'class-validator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { PrismaService } from '../prisma/pg.service'

const VALID_INCIDENT_TYPES = ['LOST_AND_FOUND','COMPLAINT','FLOW_DISRUPTION','OTHER'] as const

class CreateIncidentDto {
  @IsString()
  type: string
  @IsString() title: string
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsString() zoneId?: string
  @IsOptional() @IsString() serviceId?: string
}

class AddNoteDto {
  @IsString() body: string
}

@Injectable()
class IncidentsService {
  constructor(private prisma: PrismaService) {}

  async list(projectId: string, status?: string) {
    return this.prisma.incident.findMany({
      where: { projectId, ...(status ? { status } : {}) },
      include: {
        zone: { select: { id: true, name: true } },
        service: { select: { id: true, name: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
      orderBy: [
        { status: 'asc' }, // ESCALATED first
        { createdAt: 'desc' },
      ],
    })
  }

  async get(id: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: {
        zone: { select: { id: true, name: true } },
        service: { select: { id: true, name: true } },
        createdBy: { select: { id: true, fullName: true } },
        resolvedBy: { select: { id: true, fullName: true } },
        notes: {
          include: { author: { select: { id: true, fullName: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!incident) throw new NotFoundException('Incident not found')
    return incident
  }

  async create(dto: CreateIncidentDto, userId: string, projectId: string) {
    if (!VALID_INCIDENT_TYPES.includes(dto.type as any)) {
      throw new BadRequestException(`Invalid incident type: ${dto.type}. Valid: ${VALID_INCIDENT_TYPES.join(', ')}`)
    }
    const incident = await this.prisma.incident.create({
      data: {
        projectId,
        type: dto.type,
        title: dto.title,
        description: dto.description,
        zoneId: dto.zoneId || null,
        serviceId: dto.serviceId || null,
        createdById: userId,
        status: 'ACTIVE',
        syncState: 'SYNCED',
      },
    })

    await this.audit(incident.id, 'Incident', userId, 'CREATED', { type: dto.type, title: dto.title })
    return incident
  }

  async addNote(incidentId: string, body: string, userId: string) {
    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } })
    if (!incident) throw new NotFoundException()
    if (incident.status === 'ARCHIVED') throw new BadRequestException('Cannot add notes to archived incident')

    const note = await this.prisma.incidentNote.create({
      data: { incidentId, body, authorId: userId },
      include: { author: { select: { id: true, fullName: true } } },
    })

    await this.audit(incidentId, 'Incident', userId, 'NOTE_ADDED', { body })
    return note
  }

  async escalate(incidentId: string, userId: string, role: string) {
    const MANAGER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SENIOR_MANAGER', 'SERVICE_MANAGER']
    if (!MANAGER_ROLES.includes(role)) throw new ForbiddenException('Only managers can escalate incidents')
    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } })
    if (!incident) throw new NotFoundException()
    try { assertTransition(incident.status as any, 'ESCALATED') } catch (e: any) { throw new BadRequestException(e.message) }

    const updated = await this.prisma.incident.update({
      where: { id: incidentId },
      data: { status: 'ESCALATED' },
    })

    await this.prisma.incidentNote.create({
      data: { incidentId, body: 'Incident escalated', authorId: userId },
    })

    await this.audit(incidentId, 'Incident', userId, 'ESCALATED', {})
    return updated
  }

  async resolve(incidentId: string, userId: string, role: string, note?: string) {
    const MANAGER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SENIOR_MANAGER', 'SERVICE_MANAGER']
    if (!MANAGER_ROLES.includes(role)) throw new ForbiddenException('Only managers can resolve incidents')
    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } })
    if (!incident) throw new NotFoundException()
    try { assertTransition(incident.status as any, 'RESOLVED') } catch (e: any) { throw new BadRequestException(e.message) }

    const updated = await this.prisma.incident.update({
      where: { id: incidentId },
      data: { status: 'RESOLVED', resolvedById: userId, resolvedAt: new Date() },
    })

    await this.prisma.incidentNote.create({
      data: {
        incidentId,
        body: note ? `Resolved: ${note}` : 'Incident resolved',
        authorId: userId,
      },
    })

    await this.audit(incidentId, 'Incident', userId, 'RESOLVED', { note })
    return updated
  }


  async archive(incidentId: string, userId: string, role: string) {
    const MANAGER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SENIOR_MANAGER', 'SERVICE_MANAGER']
    if (!MANAGER_ROLES.includes(role)) throw new ForbiddenException('Only managers can archive incidents')
    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } })
    if (!incident) throw new NotFoundException('Incident not found')
    try { assertTransition(incident.status as any, 'ARCHIVED') } catch (e: any) {
      throw new BadRequestException(e.message)
    }
    const updated = await this.prisma.incident.update({
      where: { id: incidentId },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    })
    await this.audit(incidentId, 'Incident', userId, 'ARCHIVED', {})
    return updated
  }

  private async audit(entityId: string, entityType: string, actorId: string, action: string, payload: object) {
    await this.prisma.auditEvent.create({
      data: { entityType, entityId, actorId, action, payload },
    })
  }

  // Helper: get projectId for a user (first active project in their org)
  async getProjectId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    const project = await this.prisma.project.findFirst({
      where: { organizationId: user!.organizationId, isActive: true },
    })
    if (!project) throw new BadRequestException('No active project found')
    return project.id
  }
}

@Controller('incidents')
@UseGuards(JwtAuthGuard)
class IncidentsController {
  constructor(private svc: IncidentsService) {}

  @Get()
  async list(@Request() req: any, @Query('status') status?: string) {
    const projectId = await this.svc.getProjectId(req.user.sub)
    return this.svc.list(projectId, status)
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.get(id)
  }

  @Post()
  async create(@Body() dto: CreateIncidentDto, @Request() req: any) {
    const projectId = await this.svc.getProjectId(req.user.sub)
    return this.svc.create(dto, req.user.sub, projectId)
  }

  @HttpCode(200)
  @Post(':id/notes')
  addNote(@Param('id') id: string, @Body() dto: AddNoteDto, @Request() req: any) {
    return this.svc.addNote(id, dto.body, req.user.sub)
  }

  @HttpCode(200)
  @Post(':id/escalate')
  escalate(@Param('id') id: string, @Request() req: any) {
    return this.svc.escalate(id, req.user.sub, req.user.role)
  }

  @HttpCode(200)
  @Post(':id/resolve')
  resolve(@Param('id') id: string, @Body() body: { note?: string }, @Request() req: any) {
    return this.svc.resolve(id, req.user.sub, req.user.role, body.note)
  }

  @HttpCode(200)
  @Post(':id/archive')
  archive(@Param('id') id: string, @Request() req: any) {
    return this.svc.archive(id, req.user.sub, req.user.role)
  }
}

@Module({
  controllers: [IncidentsController],
  providers: [IncidentsService],
})
export class IncidentsModule {}
