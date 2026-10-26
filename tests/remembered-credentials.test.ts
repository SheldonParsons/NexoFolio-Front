import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => vi.unstubAllGlobals())

it('preserves the opt-out revision fence over HTTP without randomUUID', async () => {
  vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
  vi.stubGlobal('window', { location: { origin: 'http://intranet.test' } })
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  })
  const credentials = await import('@/features/auth/rememberedCredentials')
  credentials.setRememberPreference(true)
  const revision = credentials.credentialPreferenceRevision()
  expect(revision).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/)
  credentials.rememberSuccessfulLogin('fixture-account', 'fixture-password', true, revision)
  expect(credentials.readRememberedCredentials().account).toBe('fixture-account')
  credentials.setRememberPreference(false)
  expect(credentials.credentialPreferenceRevision()).not.toBe(revision)
  credentials.rememberSuccessfulLogin('late-account', 'late-password', true, revision)
  expect(credentials.readRememberedCredentials()).toEqual({
    enabled: false,
    account: '',
    password: '',
  })
})
