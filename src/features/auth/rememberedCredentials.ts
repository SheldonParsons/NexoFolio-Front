export interface RememberedCredentials {
  enabled: boolean
  account: string
  password: string
}

// Same behavior as Fetcher, scoped to this site's configured API service.
// Browser storage is local persistence, not a secure vault or password encryption.
const service = new URL(import.meta.env.VITE_API_BASE_URL || '/api', window.location.origin).href
const key = `nexofolio.credentials.v1:${encodeURIComponent(service)}`
export function credentialPreferenceRevision(): string | null {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  const value = JSON.parse(raw) as { revision?: unknown } | null
  return typeof value?.revision === 'string' ? value.revision : null
}
export function readRememberedCredentials(): RememberedCredentials {
  const raw = localStorage.getItem(key)
  if (!raw) return { enabled: true, account: '', password: '' }
  const value = JSON.parse(raw) as Partial<RememberedCredentials> | null
  if (!value || typeof value.enabled !== 'boolean')
    return { enabled: true, account: '', password: '' }
  return {
    enabled: value.enabled,
    account: value.enabled && typeof value.account === 'string' ? value.account : '',
    password: value.enabled && typeof value.password === 'string' ? value.password : '',
  }
}
export function setRememberPreference(enabled: boolean) {
  // Disabling works even if an old entry is malformed.
  const value = enabled
    ? { ...readRememberedCredentials(), enabled }
    : { enabled, account: '', password: '' }
  localStorage.setItem(key, JSON.stringify({ ...value, revision: crypto.randomUUID() }))
}
export function rememberSuccessfulLogin(
  account: string,
  password: string,
  enabled: boolean,
  revision: string | null,
) {
  if (credentialPreferenceRevision() !== revision) return
  // Honor a preference disabled in another tab while the login was pending.
  const remember = enabled && readRememberedCredentials().enabled
  localStorage.setItem(
    key,
    JSON.stringify({
      enabled: remember,
      account: remember ? account : '',
      password: remember ? password : '',
      revision,
    }),
  )
}
