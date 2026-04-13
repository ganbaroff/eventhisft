import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import * as request from 'supertest'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { JwtStrategy } from './jwt.strategy'
import { PgService } from '../prisma/pg.service'
import * as bcrypt from 'bcryptjs'

// ── In-memory user store ───────────────────────────────────────────────────

const db: Record<string, any> = {}

const mockPrisma = {
  user: {
    findUnique: jest.fn(({ where }: any) => {
      if (where.email) return Promise.resolve(db[where.email] ?? null)
      if (where.id)    return Promise.resolve(Object.values(db).find((u: any) => u.id === where.id) ?? null)
      return Promise.resolve(null)
    }),
  },
  $connect:    jest.fn(),
  $disconnect: jest.fn(),
}

// ── App factory ────────────────────────────────────────────────────────────

async function createApp(): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [() => ({
          JWT_SECRET: 'test-secret-32-chars-minimum-ok!!',
          JWT_REFRESH_SECRET: 'test-refresh-secret-32-chars-ok!!',
        })],
      }),
      PassportModule,
      JwtModule.registerAsync({
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (cfg: ConfigService) => ({
          secret: cfg.get('JWT_SECRET'),
          signOptions: { expiresIn: '15m' },
        }),
      }),
    ],
    controllers: [AuthController],
    providers: [
      AuthService,
      JwtStrategy,
      { provide: PgService, useValue: mockPrisma },
    ],
  }).compile()

  const app = moduleRef.createNestApplication()
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  await app.init()
  return app
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Auth Integration — POST /auth/login, GET /auth/me', () => {
  let app: INestApplication

  beforeAll(async () => {
    const hash = await bcrypt.hash('correct-password', 1) // rounds=1 for speed in tests
    db['coord@ops.local'] = {
      id: 'user-int-1',
      email: 'coord@ops.local',
      passwordHash: hash,
      fullName: 'Integration Coordinator',
      role: 'COORDINATOR',
      isActive: true,
    }
    db['inactive@ops.local'] = {
      id: 'user-int-2',
      email: 'inactive@ops.local',
      passwordHash: hash,
      fullName: 'Inactive User',
      role: 'COORDINATOR',
      isActive: false,
    }
    app = await createApp()
  })

  afterAll(async () => { await app.close() })

  beforeEach(() => {
    mockPrisma.user.findUnique.mockImplementation(({ where, select }: any) => {
      let user: any = null
      if (where.email) user = db[where.email] ?? null
      if (where.id)    user = Object.values(db).find((u: any) => u.id === where.id) ?? null
      if (!user) return Promise.resolve(null)
      if (select) {
        const result: any = {}
        Object.keys(select).forEach(k => { if (select[k] && user[k] !== undefined) result[k] = user[k] })
        return Promise.resolve(result)
      }
      return Promise.resolve(user)
    })
  })

  // ── POST /auth/login ─────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('200 + tokens for valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'coord@ops.local', password: 'correct-password' })

      expect(res.status).toBeGreaterThanOrEqual(200)
      expect(res.status).toBeLessThan(300)
      expect(res.body).toHaveProperty('accessToken')
      expect(res.body).toHaveProperty('refreshToken')
      expect(typeof res.body.accessToken).toBe('string')
      expect(res.body.accessToken.split('.').length).toBe(3) // valid JWT shape
    })

    it('401 for wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'coord@ops.local', password: 'wrong' })

      expect(res.status).toBe(401)
      expect(res.body).not.toHaveProperty('accessToken')
    })

    it('401 for unknown email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ghost@ops.local', password: 'correct-password' })

      expect(res.status).toBe(401)
    })

    it('401 for inactive user', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'inactive@ops.local', password: 'correct-password' })

      expect(res.status).toBe(401)
    })

    it('400 for missing email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ password: 'correct-password' })

      expect(res.status).toBe(400)
    })

    it('400 for missing password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'coord@ops.local' })

      expect(res.status).toBe(400)
    })

    it('400 for invalid email format', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'not-an-email', password: 'correct-password' })

      expect(res.status).toBe(400)
    })

    it('401 for short wrong password (no length enumeration)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'coord@ops.local', password: '123' })

      // Must be 401 not 400 — revealing password is too short leaks info
      expect(res.status).toBe(401)
    })

    it('same error message for wrong password vs unknown email — no enumeration', async () => {
      const r1 = await request(app.getHttpServer())
        .post('/auth/login').send({ email: 'ghost@ops.local', password: 'x123456' })
      const r2 = await request(app.getHttpServer())
        .post('/auth/login').send({ email: 'coord@ops.local', password: 'wronggg' })

      expect(r1.status).toBe(r2.status)
      expect(r1.body.message).toBe(r2.body.message)
    })
  })

  // ── GET /auth/me ─────────────────────────────────────────────────────────

  describe('GET /auth/me', () => {
    let accessToken: string

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'coord@ops.local', password: 'correct-password' })
      accessToken = res.body.accessToken
    })

    it('200 with user profile for valid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(200)
      expect(res.body.email).toBe('coord@ops.local')
      expect(res.body.fullName).toBe('Integration Coordinator')
      expect(res.body.role).toBe('COORDINATOR')
      expect(res.body.id).toBeDefined()
    })

    it('never returns passwordHash', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.body).not.toHaveProperty('passwordHash')
    })

    it('401 with no token', async () => {
      const res = await request(app.getHttpServer()).get('/auth/me')
      expect(res.status).toBe(401)
    })

    it('401 with malformed token', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer not.a.jwt')
      expect(res.status).toBe(401)
    })

    it('401 with tampered token', async () => {
      const [header, , signature] = accessToken.split('.')
      const tamperedPayload = Buffer.from(JSON.stringify({ sub: 'hacker', role: 'ADMIN' })).toString('base64url')
      const tampered = `${header}.${tamperedPayload}.${signature}`

      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${tampered}`)
      expect(res.status).toBe(401)
    })

    it('401 with Bearer prefix missing', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', accessToken) // no "Bearer " prefix
      expect(res.status).toBe(401)
    })
  })
})
