const KEY = 'nexofolio.session'
export interface SessionCredential {
  token: string
  expiresAt: string
}
let memory: SessionCredential | null = null
let memoryOnly = false

export function readCredential(): SessionCredential | null {
  let value = memory
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'token' in parsed &&
        'expiresAt' in parsed &&
        typeof parsed.token === 'string' &&
        typeof parsed.expiresAt === 'string'
      )
        value = { token: parsed.token, expiresAt: parsed.expiresAt }
      else value = null
    } else if (!memoryOnly) value = null
  } catch {
    /* In restricted browsers the current tab can still keep a session. */
  }
  if (
    !value?.token ||
    !Number.isFinite(Date.parse(value.expiresAt)) ||
    Date.parse(value.expiresAt) <= Date.now()
  )
    return null
  return value
}

export function saveCredential(value: SessionCredential) {
  memory = value
  try {
    localStorage.setItem(KEY, JSON.stringify(value))
    memoryOnly = false
  } catch {
    memoryOnly = true
  }
}
export function clearCredential(expectedToken?: string) {
  if (expectedToken && readCredential()?.token !== expectedToken) return
  memory = null
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* Memory-only session. */
  }
  window.dispatchEvent(new Event('nexofolio:session-cleared'))
}
