import type { CreateCredential, McpCredential } from './source'

export interface CredentialDraft {
  name: string
  validity: 'range' | 'unlimited'
  startsAt: string
  expiresAt: string
}
export const statusLabels: Record<McpCredential['status'], string> = {
  active: '有效',
  scheduled: '未生效',
  expired: '已过期',
  revoked: '已撤销',
}

/** datetime-local is intentionally converted with the user's device timezone. */
function localTime(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('请选择完整的日期和时间。')
  const date = new Date(value)
  const [year, month, day, hour, minute] = value.split(/[-T:]/).map(Number)
  // Reject impossible dates and local times skipped by daylight-saving transitions.
  if (
    !Number.isFinite(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    year! < 1
  ) {
    throw new Error('所选日期或时间无效，请重新选择。')
  }
  return date
}
export function credentialInput(draft: CredentialDraft, now = Date.now()): CreateCredential {
  const name = draft.name.trim()
  if (!name || [...name].length > 64 || /[\u0000-\u001f\u007f-\u009f]/u.test(name)) {
    throw new Error('凭证名称须为 1～64 字，不能包含控制字符。')
  }
  if (draft.validity === 'unlimited') return { name, starts_at: null, expires_at: null }
  if (!draft.startsAt || !draft.expiresAt) throw new Error('请选择开始时间和结束时间。')
  const start = localTime(draft.startsAt),
    end = localTime(draft.expiresAt)
  if (end.getTime() <= start.getTime() || end.getTime() <= now) {
    throw new Error('结束时间须晚于开始时间和当前时间。')
  }
  return { name, starts_at: start.toISOString(), expires_at: end.toISOString() }
}
export function localDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
export function newCredentialDraft(): CredentialDraft {
  const start = new Date(),
    end = new Date(start)
  end.setDate(end.getDate() + 30)
  return {
    name: '',
    validity: 'range',
    startsAt: localDateTime(start),
    expiresAt: localDateTime(end),
  }
}
export function credentialTime(value: string | null) {
  if (!value) return '无限期'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}
