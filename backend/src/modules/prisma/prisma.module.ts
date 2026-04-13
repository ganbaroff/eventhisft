import { Global, Module } from '@nestjs/common'
import { PgService } from './pg.service'

// PgService is the runtime database layer.
// It is provided under its own class token so NestJS DI resolves it
// correctly when modules inject `private prisma: PgService`.
// The alias `PrismaService` is exported purely for import convenience.

export { PgService as PrismaService }

@Global()
@Module({
  providers: [PgService],
  exports: [PgService],
})
export class PrismaModule {}
