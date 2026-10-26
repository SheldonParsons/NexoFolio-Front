import { afterEach, expect, it, vi } from 'vitest'
import { createUuid } from '@/app/uuid'

afterEach(() => vi.unstubAllGlobals())

it('uses the native UUID implementation with its Crypto receiver', () => {
  const native = '01234567-89ab-4def-8123-456789abcdef'
  const provider = {
    randomUUID() {
      expect(this).toBe(provider)
      return native
    },
  }
  vi.stubGlobal('crypto', provider)
  expect(createUuid()).toBe(native)
})

it.each([
  [0, '00000000-0000-4000-8000-000000000000'],
  [255, 'ffffffff-ffff-4fff-bfff-ffffffffffff'],
])('preserves UUID v4 version and variant for random byte value %i', (byte, expected) => {
  vi.stubGlobal('crypto', { getRandomValues: (value: Uint8Array) => value.fill(byte) })
  expect(createUuid()).toBe(expected)
})

it('uses fresh secure random values when randomUUID is unavailable', () => {
  vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
  const ids = Array.from({ length: 32 }, createUuid)
  expect(new Set(ids).size).toBe(ids.length)
  for (const id of ids)
    expect(id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/)
})

it('fails explicitly when no secure random source exists', () => {
  vi.stubGlobal('crypto', undefined)
  expect(createUuid).toThrow('无法生成操作标识')
})
