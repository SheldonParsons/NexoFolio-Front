import { describe, expect, it, vi } from 'vitest'
import { createApiClient } from '../src/api/client'

describe('API transport contract', () => {
  it('joins base paths and sends JSON without automatic retries', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: 'a' }))
    const client = createApiClient({ baseUrl: '/api/', fetcher })
    expect(await client.request('/records', { method: 'POST', json: { name: '订单' } })).toEqual({
      id: 'a',
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/records')
    expect(fetcher.mock.calls[0]?.[1]?.body).toBe('{"name":"订单"}')
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('Content-Type')).toBe(
      'application/json',
    )
  })

  it.each([
    'https://elsewhere.test/data',
    '//elsewhere.test/data',
    '../secrets',
    '%2e%2e/secrets',
    '%2f%2felsewhere.test',
    'x\\..\\secrets',
  ])('rejects paths outside the API base: %s', async (path) => {
    const fetcher = vi.fn<typeof fetch>()
    await expect(
      createApiClient({ baseUrl: '/api', fetcher }).request(path),
    ).rejects.toBeInstanceOf(TypeError)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('does not mistake an SPA HTML fallback for successful data', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response('<html>app</html>', { headers: { 'content-type': 'text/html' } }),
      )
    await expect(
      createApiClient({ baseUrl: '/api', fetcher }).request('projects'),
    ).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it('reports malformed JSON distinctly from a network outage', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response('{broken', { headers: { 'content-type': 'application/json' } }),
      )
    await expect(
      createApiClient({ baseUrl: '/api', fetcher }).request('projects'),
    ).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it('notifies the auth layer once on 401 without retrying', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 401 }))
    const onUnauthorized = vi.fn()
    await expect(
      createApiClient({ baseUrl: '/api', fetcher, onUnauthorized }).request('me'),
    ).rejects.toMatchObject({ kind: 'http', status: 401 })
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('accepts an empty 204 response', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
    expect(
      await createApiClient({ baseUrl: '/api', fetcher }).request('records/a', {
        method: 'DELETE',
      }),
    ).toBeUndefined()
  })

  it('keeps the timeout active while the response body is being consumed', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      async (_url, init) =>
        ({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () =>
            new Promise((_resolve, reject) =>
              init?.signal?.addEventListener(
                'abort',
                () => reject(new DOMException('Aborted', 'AbortError')),
                { once: true },
              ),
            ),
        }) as Response,
    )
    await expect(
      createApiClient({ baseUrl: '/api', fetcher, timeoutMs: 15 }).request('slow'),
    ).rejects.toMatchObject({ kind: 'timeout' })
  })

  it('preserves caller cancellation instead of reporting a network error', async () => {
    const controller = new AbortController()
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      throw init?.signal?.reason
    })
    controller.abort()
    await expect(
      createApiClient({ baseUrl: '/api', fetcher }).request('projects', {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })
})
