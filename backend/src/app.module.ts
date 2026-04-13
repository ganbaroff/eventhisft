import { Module, Controller, Get } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './modules/prisma/prisma.module'
import { AuthModule } from './modules/auth/auth.module'
import { ContextModule } from './modules/context/context.module'
import { IncidentsModule } from './modules/incidents/incidents.module'
import { OperationsModule } from './modules/operations/operations.module'
import { ShiftsModule } from './modules/shifts/shifts.module'
import { AdminModule } from './modules/admin/admin.module'
import { SseModule } from './modules/sse/sse.module'

@Controller()
class HealthController {
  @Get('health')
  health() {
    return { status: 'ok', ts: new Date().toISOString() }
  }
}

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ContextModule,
    IncidentsModule,
    OperationsModule,
    ShiftsModule,
    AdminModule,
    SseModule,
  ],
})
export class AppModule {}
