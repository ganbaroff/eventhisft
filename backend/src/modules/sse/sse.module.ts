import {
  Module, Controller, Get, Sse, UseGuards,
  Request, Injectable, MessageEvent,
} from '@nestjs/common'
import { Observable, interval, map, switchMap, startWith } from 'rxjs'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { PgService } from '../prisma/pg.service'

// ── SSE payload ───────────────────────────────────────────────────────────────

interface NowSnapshot {
  escalated: number
  active: number
  total: number
  hasAttention: boolean
  lastUpdated: string
}

@Injectable()
class SseService {
  constructor(private pg: PgService) {}

  async getSnapshot(userId: string): Promise<NowSnapshot> {
    // Get user's org → project
    const user = await this.pg.queryOne<any>(
      'SELECT "organizationId" FROM "User" WHERE id=$1', [userId]
    )
    if (!user) return this.empty()

    const project = await this.pg.queryOne<any>(
      'SELECT id FROM "Project" WHERE "organizationId"=$1 AND "isActive"=true LIMIT 1',
      [user.organizationId]
    )
    if (!project) return this.empty()

    const [escRow, actRow] = await Promise.all([
      this.pg.queryOne<any>(
        'SELECT count(*)::int AS n FROM "Incident" WHERE "projectId"=$1 AND status=\'ESCALATED\'',
        [project.id]
      ),
      this.pg.queryOne<any>(
        'SELECT count(*)::int AS n FROM "Incident" WHERE "projectId"=$1 AND status=\'ACTIVE\'',
        [project.id]
      ),
    ])

    const escalated = escRow?.n ?? 0
    const active    = actRow?.n ?? 0

    return {
      escalated,
      active,
      total: escalated + active,
      hasAttention: escalated > 0,
      lastUpdated: new Date().toISOString(),
    }
  }

  private empty(): NowSnapshot {
    return { escalated: 0, active: 0, total: 0, hasAttention: false, lastUpdated: new Date().toISOString() }
  }
}

@Controller('sse')
@UseGuards(JwtAuthGuard)
class SseController {
  constructor(private svc: SseService) {}

  // SSE endpoint — pushes NOW snapshot every 15 seconds
  // Client connects once, receives updates without polling
  @Sse('now')
  nowStream(@Request() req: any): Observable<MessageEvent> {
    const userId = req.user.sub
    return interval(15_000).pipe(
      startWith(0),
      switchMap(() => this.svc.getSnapshot(userId)),
      map(snapshot => ({
        data: JSON.stringify(snapshot),
        type: 'now-update',
      }))
    )
  }
}

@Module({
  controllers: [SseController],
  providers: [SseService],
})
export class SseModule {}
