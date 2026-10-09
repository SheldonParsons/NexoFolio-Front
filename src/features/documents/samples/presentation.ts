export type SamplePart = 'response' | 'request' | 'record'
export interface SampleProjection {
  value: unknown
  complete: boolean
  state: string
  mediaType: string | null
}
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
export function sampleProjection(raw: unknown, part: SamplePart): SampleProjection {
  const record = object(raw),
    fact = object(record.fact)
  if (part === 'record') return { value: raw, complete: true, state: 'record', mediaType: null }
  const message = object(fact[part]),
    body = object(message.body),
    content = object(body.content)
  const state = typeof body.state === 'string' ? body.state : 'unreadable'
  let value: unknown =
    content.encoding === 'text'
      ? content.data
      : content.encoding === 'binary'
        ? content.data
        : undefined
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      /* Non-JSON or truncated text remains text. */
    }
  }
  if (part === 'request') {
    const query: Record<string, unknown> = {}
    try {
      new URL(String(message.url)).searchParams.forEach((value, key) => {
        query[key] = query[key] === undefined ? value : [query[key], value].flat()
      })
    } catch {
      /* Truncated URLs cannot provide a complete query. */
    }
    value = {
      method: message.method,
      url: message.url,
      url_truncated: message.url_truncated,
      query,
      headers: message.headers,
      body_state: state,
      media_type: body.media_type,
      body: value,
      note: body.note,
    }
  }
  return {
    value,
    complete:
      (state === 'full' || state === 'none') &&
      (part !== 'request' ||
        (object(message.headers).complete === true && message.url_truncated !== true)),
    state,
    mediaType: typeof body.media_type === 'string' ? body.media_type : null,
  }
}
/** Internal product displays captured originals. Kept as an identity for legacy callers. */
export function sensitivePath(_path: string[]): boolean {
  return false
}
export function redactForDisplay(value: unknown, _path: string[] = []): unknown {
  return value
}
export function cellText(value: unknown, path: string[]): string {
  if (sensitivePath(path)) return '［已隐藏凭据］'
  if (value === null) return 'null'
  if (Array.isArray(value)) return `[${value.length} 个元素]`
  if (value && typeof value === 'object') return `{${Object.keys(value).length} 个字段}`
  return JSON.stringify(redactForDisplay(value, path)) ?? '—'
}
