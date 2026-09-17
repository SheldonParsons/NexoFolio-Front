import { describe, expect, it, vi } from 'vitest'
import { parseDownloadsResponse, type DesktopChannel } from '../src/features/downloads/releases'
import { createDownloadCatalog } from '../src/features/downloads/useDownloads'

const base = 'https://asynctest.oss-cn-shenzhen.aliyuncs.com/'
function response(channel: DesktopChannel, desktopVersion = '3.3.10', fetcherVersion = '0.1.0') {
  const filename = `NexoFolio-Fetcher-${fetcherVersion}-dev.zip`
  return {
    schema_version: 1,
    desktop_channel: channel,
    fetcher: {
      status: 'ready',
      release: {
        version: fetcherVersion,
        url: `${base}nexofolio_fetcher/${filename}`,
        filename,
        size: 176441,
        sha256: 'a'.repeat(64),
        minimum_chrome_version: '125',
        channel: 'development',
        installation: 'load-unpacked',
      },
    },
    desktop: [
      {
        platform: 'windows',
        status: 'ready',
        release: {
          version: desktopVersion,
          url: `${base}core/updates/${channel}/win/x64/setup.exe`,
          filename: 'setup.exe',
          size: 100,
        },
      },
      {
        platform: 'mac-arm64',
        status: 'ready',
        release: {
          version: desktopVersion,
          url: `${base}core/updates/${channel}/mac/arm64/app.dmg`,
          filename: 'app.dmg',
          size: 100,
        },
      },
      {
        platform: 'mac-x64',
        status: 'ready',
        release: {
          version: desktopVersion,
          url: `${base}core/updates/${channel}/mac/x64/app.dmg`,
          filename: 'app.dmg',
          size: 100,
        },
      },
    ],
  }
}
const channelOf = (input: unknown): DesktopChannel =>
  String(input).endsWith('desktop_channel=public') ? 'public' : 'internal'

describe('backend download response contract', () => {
  it('maps development installation details and all desktop platforms', () => {
    const data = parseDownloadsResponse(response('internal'), 'internal')
    expect(data.fetcher.release).toMatchObject({ version: '0.1.0', minimumChromeVersion: '125' })
    expect(data.desktop.map((item) => item.id)).toEqual(['windows', 'mac-arm64', 'mac-x64'])
  })
  it('rejects the wrong channel instead of silently showing another build', () => {
    expect(() => parseDownloadsResponse(response('public'), 'internal')).toThrow()
  })
  it('rejects unknown schema and duplicate or missing platforms', () => {
    expect(() =>
      parseDownloadsResponse({ ...response('internal'), schema_version: 2 }, 'internal'),
    ).toThrow()
    const data = response('internal')
    data.desktop[1] = data.desktop[0]!
    expect(() => parseDownloadsResponse(data, 'internal')).toThrow()
    expect(() => parseDownloadsResponse({ ...data, desktop: [] }, 'internal')).toThrow()
  })
  it('keeps independent ready, unpublished and error results', () => {
    const data = response('internal') as Record<string, any>
    data.desktop[0] = { platform: 'windows', status: 'unpublished', release: null }
    data.desktop[1] = { platform: 'mac-arm64', status: 'error', release: null }
    const parsed = parseDownloadsResponse(data, 'internal')
    expect(parsed.desktop.map((p) => p.status)).toEqual(['unpublished', 'error', 'ready'])
    expect(parsed.fetcher.release?.version).toBe('0.1.0')
  })
  it('does not accept a non-development Fetcher under the development label', () => {
    const data = response('internal')
    data.fetcher.release.channel = 'stable'
    expect(() => parseDownloadsResponse(data, 'internal')).toThrow()
  })
  it.each([
    'javascript:alert(1)',
    'http://example.test/app.zip',
    'https://example.test/not-the-package.zip',
  ])('rejects unsafe or mismatched download target %s', (url) => {
    const data = response('internal')
    data.fetcher.release.url = url
    expect(() => parseDownloadsResponse(data, 'internal')).toThrow()
  })
  it('rejects a Mac updater ZIP instead of an installer DMG', () => {
    const data = response('internal')
    data.desktop[1]!.release.filename = 'app.zip'
    data.desktop[1]!.release.url = `${base}app.zip`
    expect(() => parseDownloadsResponse(data, 'internal')).toThrow()
  })
})

describe('same-origin backend download requests', () => {
  it('makes one backend request per channel, with no OSS metadata requests or refresh parameter', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) => Response.json(response(channelOf(input))))
    const catalog = createDownloadCatalog(fetcher)
    await catalog.refresh()
    expect(catalog.state.channel).toBe('internal')
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0]![0]).toBe('/api/v1/downloads?desktop_channel=internal')
    expect(new Headers(fetcher.mock.calls[0]![1]?.headers).has('Authorization')).toBe(false)
    await catalog.selectChannel('public')
    expect(catalog.state.desktop.public.every((p) => p.release?.url.includes('/public/'))).toBe(
      true,
    )
    await catalog.selectChannel('internal')
    expect(fetcher).toHaveBeenCalledTimes(3)
    await catalog.refresh()
    expect(fetcher).toHaveBeenCalledTimes(4)
    expect(
      fetcher.mock.calls.every(([url]) =>
        /^\/api\/v1\/downloads\?desktop_channel=(internal|public)$/.test(String(url)),
      ),
    ).toBe(true)
  })
  it('deduplicates concurrent reads of the same channel', async () => {
    let resolve!: (data: Response) => void
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r
        }),
    )
    const catalog = createDownloadCatalog(fetcher)
    const first = catalog.refresh()
    const second = catalog.refresh()
    expect(fetcher).toHaveBeenCalledTimes(1)
    resolve(Response.json(response('internal')))
    await Promise.all([first, second])
  })
  it('isolates late channel results and does not overwrite newer Fetcher metadata', async () => {
    let releaseOld!: () => void
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      if (channelOf(input) === 'internal')
        return new Promise<Response>((resolve) => {
          releaseOld = () => resolve(Response.json(response('internal', '3.3.10', '0.1.0')))
        })
      return Response.json(response('public', '3.3.11', '0.2.0'))
    })
    const catalog = createDownloadCatalog(fetcher)
    const old = catalog.refresh()
    await catalog.selectChannel('public')
    releaseOld()
    await old
    expect(catalog.state.channel).toBe('public')
    expect(catalog.state.desktop.public.every((p) => p.release?.version === '3.3.11')).toBe(true)
    expect(catalog.state.fetcher.release?.version).toBe('0.2.0')
  })
  it.each([404, 503])(
    'does not fall back to OSS or public builds when the backend returns %s',
    async (status) => {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status }))
      const catalog = createDownloadCatalog(fetcher)
      await catalog.refresh()
      expect(catalog.state.channel).toBe('internal')
      expect(catalog.state.desktop.internal.every((p) => p.status === 'error' && !p.release)).toBe(
        true,
      )
      expect(catalog.state.fetcher.status).toBe('error')
      expect(fetcher).toHaveBeenCalledTimes(1)
    },
  )
  it('shows a backend unpublished item as pending upload while keeping desktop downloads', async () => {
    const data: Record<string, any> = response('internal')
    data.fetcher = { status: 'unpublished', release: null }
    const catalog = createDownloadCatalog(
      vi.fn<typeof fetch>().mockResolvedValue(Response.json(data)),
    )
    await catalog.refresh()
    expect(catalog.state.fetcher.status).toBe('unpublished')
    expect(catalog.state.desktop.internal.every((p) => p.status === 'ready')).toBe(true)
  })
})
