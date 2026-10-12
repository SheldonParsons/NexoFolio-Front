import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../src/api'
import {
  accessReport,
  accessTitle,
  accessProjectName,
  actorName,
  auditTime,
  canInspectAccess,
} from '../src/features/audit/analysis'
const params = new URLSearchParams({ view: 'ranking', page: '1', limit: '20' })
const signal = new AbortController().signal

describe('current access detail reports', () => {
  it('accepts a genuinely empty result without manufacturing an error', async () => {
    const result = await accessReport(
      params,
      signal,
      vi
        .fn()
        .mockResolvedValue({
          items: [],
          total: 0,
          page: 1,
          limit: 20,
          matching_visits: 0,
          coverage: {},
        }),
    )
    expect(result.items).toEqual([])
    expect(result.total).toBe(0)
  })
  it('keeps missing record fields unknown and refuses an ambiguous drilldown', async () => {
    const result = await accessReport(
      params,
      signal,
      vi.fn().mockResolvedValue({ items: [{}], total: 1, page: 1, limit: 20 }),
    )
    const row = result.items[0]!
    expect(accessTitle(row)).toBe('访问类型未记录')
    expect(accessProjectName(row, result)).toBe('项目未记录')
    expect(actorName(row, result)).toBe('未知访问身份')
    expect(auditTime('not-a-date')).toBe('未记录')
    expect(result.matching_visits).toBeUndefined()
    expect(row.hits).toBeUndefined()
    expect(canInspectAccess(row)).toBe(false)
  })
  it('does not hide real read failures or malformed paging as empty data', async () => {
    const failure = new ApiError('read failed', 'http', 503)
    await expect(accessReport(params, signal, vi.fn().mockRejectedValue(failure))).rejects.toBe(
      failure,
    )
    await expect(
      accessReport(params, signal, vi.fn().mockResolvedValue({ items: [], total: 0 })),
    ).rejects.toMatchObject({ kind: 'invalid-response' })
  })
  it('uses only the current record identity for drilldown and never substitutes an hour timestamp', async () => {
    const result = await accessReport(
      params,
      signal,
      vi
        .fn()
        .mockResolvedValue({
          items: [
            {
              kind: 'page',
              project: '',
              resource: '',
              route: 'home',
              action: 'page.view',
              method: 'BROWSER',
              hour: '2026-10-11T08:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          limit: 20,
        }),
    )
    expect(canInspectAccess(result.items[0]!)).toBe(true)
    expect(auditTime(result.items[0]!.at)).toBe('未记录')
  })
})
