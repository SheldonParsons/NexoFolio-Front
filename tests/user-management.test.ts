import { expect, it, vi } from 'vitest'
import { listManagementUsers } from '@/features/management/users'

const user = {
  id: '20000000-0000-4000-8000-000000000001',
  account: 'member',
  display_name: '示例用户',
  avatar_url: null,
  enabled: true,
  created_at: '2026-10-01T00:00:00Z',
  last_login_at: '2026-10-11T00:00:00Z',
}
const signal = new AbortController().signal
it('uses paged server-side name/account search and keeps avatar and total metadata', async () => {
  const result = {
    items: [{ ...user, avatar_url: 'data:image/webp;base64,UklGRg==' }],
    page: 2,
    limit: 20,
    total: 21,
  }
  const request = vi.fn().mockResolvedValue(result)
  expect(await listManagementUsers({ page: 2, limit: 20, q: ' 示例 ' }, signal, request)).toEqual(
    result,
  )
  const params = new URL(request.mock.calls[0]![0], 'http://fixture').searchParams
  expect(params.get('q')).toBe('示例')
  expect(params.get('page')).toBe('2')
  expect(request.mock.calls[0]![1]).toEqual({ signal })
})
it.each([
  { items: [null], page: 1, limit: 20, total: 1 },
  { items: [user, user], page: 1, limit: 20, total: 2 },
  { items: [{ ...user, created_at: 'unknown' }], page: 1, limit: 20, total: 1 },
  { items: [user], page: 2, limit: 20, total: 1 },
  { items: [user], page: 1, limit: 20, total: 0 },
])('rejects malformed or inconsistent private user pages', async (result) => {
  await expect(
    listManagementUsers({ page: 1, limit: 20 }, signal, vi.fn().mockResolvedValue(result)),
  ).rejects.toMatchObject({ kind: 'invalid-response' })
})
