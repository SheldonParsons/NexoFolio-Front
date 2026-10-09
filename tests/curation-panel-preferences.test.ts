import { expect, it } from 'vitest'
import {
  readPanelSize,
  writePanelSize,
  CURATION_PANEL_SIZE_KEY,
} from '@/features/curation/panelSize'
import { eventState, workKey, workState } from '@/features/curation/workPresentation'

it('restores each display size across independent reads', () => {
  const entries = new Map<string, string>()
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value)
    },
  }
  for (const size of ['full', 'compact', 'mini'] as const) {
    writePanelSize(size, storage)
    expect(readPanelSize(storage)).toBe(size)
  }
  entries.set(CURATION_PANEL_SIZE_KEY, 'invalid')
  expect(readPanelSize(storage)).toBe('full')
})

it('keeps curation usable when browser persistence is unavailable', () => {
  const storage = {
    getItem: () => {
      throw new Error('blocked')
    },
    setItem: () => {
      throw new Error('blocked')
    },
  }
  expect(readPanelSize(storage)).toBe('full')
  expect(() => writePanelSize('mini', storage)).not.toThrow()
})

const work = {
  endpoint: 'a',
  task_id: 1,
  name: '接口 A',
  path: '/a',
  fields: 24,
  completed: 12,
  batch: 1,
  batches: 2,
  attempt: 2,
  started_at: '2026-10-08T00:00:00Z',
}
it('keeps concurrent batches separate without presenting saving as saved', () => {
  expect(workKey('fields', work)).not.toBe(workKey('fields', { ...work, task_id: 2 }))
  expect(workKey('fields', work)).not.toBe(workKey('describe', work))
  expect(workState(work)).toBe('retrying')
  expect(workState({ ...work, state: 'saving' })).toBe('saving')
  expect(
    eventState({ id: 1, at: work.started_at, stage: 'fields', kind: 'saved', message: '已保存' }),
  ).toBe('saved')
  expect(
    eventState({ id: 1, at: work.started_at, stage: 'fields', kind: 'started', message: '开始' }),
  ).toBe('idle')
})
