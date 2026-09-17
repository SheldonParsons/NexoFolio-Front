export interface ReleaseArtifact {
  version: string
  url: string
  filename: string
  size: number
}
export interface FetcherRelease extends ReleaseArtifact {
  sha256: string
  minimumChromeVersion: string
}
export type DesktopPlatform = 'windows' | 'mac-arm64' | 'mac-x64'
export type DesktopChannel = 'internal' | 'public'
export type ReleaseStatus = 'ready' | 'unpublished' | 'error'
export interface ReleaseState<T> {
  status: ReleaseStatus
  release: T | null
}
export const desktopPlatforms: { id: DesktopPlatform; label: string; extension: string }[] = [
  { id: 'windows', label: 'Windows · x64', extension: '.exe' },
  { id: 'mac-arm64', label: 'macOS · Apple Silicon', extension: '.dmg' },
  { id: 'mac-x64', label: 'macOS · Intel', extension: '.dmg' },
]

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('下载版本响应格式无效')
  return value as Record<string, unknown>
}
function artifact(value: unknown, extension: string): ReleaseArtifact {
  const data = record(value)
  if (
    typeof data.version !== 'string' ||
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(data.version) ||
    typeof data.filename !== 'string' ||
    !data.filename.endsWith(extension) ||
    /[/\\?#]/.test(data.filename) ||
    typeof data.url !== 'string' ||
    typeof data.size !== 'number' ||
    !Number.isSafeInteger(data.size) ||
    data.size <= 0
  )
    throw new Error('下载包信息无效')
  const url = new URL(data.url)
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    decodeURIComponent(url.pathname.split('/').at(-1)!) !== data.filename
  )
    throw new Error('下载地址无效')
  return { version: data.version, filename: data.filename, url: url.href, size: data.size }
}
function releaseState<T>(value: unknown, parse: (value: unknown) => T): ReleaseState<T> {
  const data = record(value)
  if (data.status === 'ready') return { status: 'ready', release: parse(data.release) }
  if ((data.status === 'unpublished' || data.status === 'error') && data.release === null)
    return { status: data.status, release: null }
  throw new Error('下载状态与版本信息不一致')
}
export function parseDownloadsResponse(value: unknown, channel: DesktopChannel) {
  const data = record(value)
  if (
    data.schema_version !== 1 ||
    data.desktop_channel !== channel ||
    !Array.isArray(data.desktop) ||
    data.desktop.length !== desktopPlatforms.length
  )
    throw new Error('下载渠道或响应版本不匹配')
  const fetcher = releaseState(data.fetcher, (value): FetcherRelease => {
    const item = record(value),
      result = artifact(item, '.zip')
    if (
      item.channel !== 'development' ||
      item.installation !== 'load-unpacked' ||
      typeof item.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(item.sha256) ||
      typeof item.minimum_chrome_version !== 'string' ||
      !/^\d+(?:\.\d+)*$/.test(item.minimum_chrome_version)
    )
      throw new Error('Fetcher 开发版信息无效')
    return { ...result, sha256: item.sha256, minimumChromeVersion: item.minimum_chrome_version }
  })
  const items = data.desktop.map(record)
  const desktop = desktopPlatforms.map((platform) => {
    const matches = items.filter((item) => item.platform === platform.id)
    if (matches.length !== 1) throw new Error('桌面平台列表不完整或重复')
    return {
      id: platform.id,
      ...releaseState(matches[0], (value) => artifact(value, platform.extension)),
    }
  })
  return { fetcher, desktop }
}
