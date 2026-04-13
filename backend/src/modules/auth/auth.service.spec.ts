import { UnauthorizedException } from '@nestjs/common'
import { AuthService } from './auth.service'

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockUser = {
  id: 'user-1',
  email: 'test@opsboard.local',
  passwordHash: '',
  fullName: 'Test User',
  role: 'COORDINATOR',
  isActive: true,
}

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
}

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-access-token'),
}

const mockConfig = {
  get: jest.fn((key: string) => {
    if (key === 'JWT_SECRET') return 'test-secret'
    if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret'
    return null
  }),
}

// We mock bcryptjs at module level
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed-password'),
}))

import * as bcrypt from 'bcryptjs'

// ── Tests ──────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new AuthService(
      mockPrisma as any,
      mockJwtService as any,
      mockConfig as any,
    )
  })

  // ── login ────────────────────────────────────────────────────────────────

  describe('login()', () => {
    it('returns tokens for valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

      const result = await service.login('test@opsboard.local', 'correct-password')

      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@opsboard.local' },
      })
    })

    it('throws UnauthorizedException for wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)

      await expect(service.login('test@opsboard.local', 'wrong')).rejects.toThrow(
        UnauthorizedException,
      )
    })

    it('throws UnauthorizedException for unknown email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      await expect(service.login('ghost@x.com', 'any')).rejects.toThrow(
        UnauthorizedException,
      )
    })

    it('throws UnauthorizedException for inactive user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false })
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

      await expect(service.login('test@opsboard.local', 'correct')).rejects.toThrow(
        UnauthorizedException,
      )
    })

    it('does not expose whether email exists in error message', async () => {
      // Both unknown email and wrong password return the same error
      mockPrisma.user.findUnique.mockResolvedValue(null)
      let err1: Error | null = null
      try { await service.login('ghost@x.com', 'x') } catch (e: any) { err1 = e }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)
      let err2: Error | null = null
      try { await service.login('test@opsboard.local', 'wrong') } catch (e: any) { err2 = e }

      expect(err1?.message).toBe(err2?.message)
    })
  })

  // ── me ───────────────────────────────────────────────────────────────────

  describe('me()', () => {
    it('returns user data without passwordHash', async () => {
      const selectResult = {
        id: mockUser.id,
        email: mockUser.email,
        fullName: mockUser.fullName,
        role: mockUser.role,
        isActive: mockUser.isActive,
      }
      mockPrisma.user.findUnique.mockResolvedValue(selectResult)

      const result = await service.me('user-1')

      expect(result).toEqual(selectResult)
      expect(result).not.toHaveProperty('passwordHash')
    })

    it('throws UnauthorizedException for unknown userId', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      await expect(service.me('nonexistent')).rejects.toThrow(UnauthorizedException)
    })
  })

  // ── issueTokens ───────────────────────────────────────────────────────────

  describe('token issuing', () => {
    it('access token and refresh token are different', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

      const result = await service.login('test@opsboard.local', 'correct')

      expect(result.accessToken).not.toBe(result.refreshToken)
    })

    it('calls jwtService.sign with correct payload shape', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

      await service.login('test@opsboard.local', 'correct')

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: mockUser.id, role: mockUser.role }),
      )
    })
  })
})
