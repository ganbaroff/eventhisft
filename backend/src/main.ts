import { NestFactory } from '@nestjs/core'
import { ValidationPipe, Logger } from '@nestjs/common'
import helmet from 'helmet'
import { AppModule } from './app.module'
import { GlobalExceptionFilter } from './common/filters/global-exception.filter'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const logger = new Logger('Bootstrap')

  const frontendUrl = process.env.FRONTEND_URL
  if (process.env.NODE_ENV === 'production' && !frontendUrl) {
    throw new Error('FRONTEND_URL env var is required in production')
  }

  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }))
  const http: any = app.getHttpAdapter().getInstance()
  if (http && typeof http.disable === 'function') http.disable('x-powered-by')

  app.enableCors({
    origin: frontendUrl ?? 'http://localhost:5173',
    credentials: true,
  })

  app.useGlobalFilters(new GlobalExceptionFilter())

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  const port = process.env.PORT ?? 3001
  await app.listen(port)
  logger.log(`OPSBOARD API running on port ${port}`)
  logger.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`)
}

bootstrap()
