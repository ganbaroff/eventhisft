import { generateLocalId, isOnline } from '../utils/offline'

// ── generateLocalId ────────────────────────────────────────────────────────

describe('generateLocalId()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateLocalId()).toBe('string')
    expect(generateLocalId().length).toBeGreaterThan(0)
  })

  it('starts with "local_"', () => {
    expect(generateLocalId()).toMatch(/^local_/)
  })

  it('generates unique IDs on repeated calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateLocalId()))
    expect(ids.size).toBe(100)
  })

  it('contains a timestamp component', () => {
    const before = Date.now()
    const id = generateLocalId()
    const after = Date.now()
    // Extract timestamp from id: local_{timestamp}_{random}
    const ts = parseInt(id.split('_')[1])
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })
})

// ── isOnline ───────────────────────────────────────────────────────────────

describe('isOnline()', () => {
  const originalOnLine = Object.getOwnPropertyDescriptor(navigator, 'onLine')

  afterEach(() => {
    // Restore original descriptor
    if (originalOnLine) {
      Object.defineProperty(navigator, 'onLine', originalOnLine)
    }
  })

  it('returns true when navigator.onLine is true', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    expect(isOnline()).toBe(true)
  })

  it('returns false when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    expect(isOnline()).toBe(false)
  })
})
