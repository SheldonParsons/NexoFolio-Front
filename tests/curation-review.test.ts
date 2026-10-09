import { describe, expect, it } from 'vitest'
import { candidateChanges } from '@/features/curation/changes'
import { elapsedLabel, phaseProgress, progressLabel } from '@/features/curation/progress'
import type { Candidate, KnowledgeSnapshot } from '@/features/curation/types'
import type { CurateProgress, FieldNote } from '@/contracts/knowledge/types'
import { candidateIndex } from '@/features/curation/candidateTree'
import { documentTree, findFolder } from '@/features/documents/documentTree'
import type { DocumentIndex } from '@/features/documents/source'
import navigationFixture from './fixtures/document-navigation.json'
const snapshot = (): KnowledgeSnapshot => ({
  endpoints: ['e1'],
  folders: [],
  placements: [],
  notes: [],
  fields: [],
  links: [],
})
const candidate = (): Candidate => ({
  id: 'candidate',
  project_id: 'project',
  target: null,
  parent: null,
  state: 'ready',
  created_at: '',
  updated_at: '',
  base_hash: 'fixture',
  base: snapshot(),
  view: snapshot(),
  batches: [],
  progress: {},
  applied_rounds: [],
  reviewed_by: null,
})
const field = (text = '记录标识，业务范围待确认'): FieldNote => ({
  endpoint: 'e1',
  path: 'response:200/id',
  text,
  values: [],
  context: {
    location: { in: 'response_body', status: 200 },
    field_path: 'id',
    input_hash: 'old',
    evidence: [],
    display_name: '记录标识',
  },
})
const job = (overrides: Partial<CurateProgress> = {}): CurateProgress => ({
  status: 'running',
  stage: 'fields',
  completed: 47,
  total: 47,
  generated: 0,
  unchanged: 47,
  fields_completed: 45,
  message: null,
  ...overrides,
})
describe('semantic candidate review', () => {
  it('previews candidate hierarchy across environments without changing approved placement or names', () => {
    const official = structuredClone(navigationFixture) as DocumentIndex
    const original = structuredClone(official)
    const c = candidate()
    const [first, second] = official.entries
    c.view.endpoints = [first!.interface_id, second!.interface_id]
    c.view.folders = [
      {
        id: 'new-root',
        parent: null,
        name: '候选业务',
        summary: null,
        position: 0,
        endpoints: 0,
        endpoints_deep: 0,
      },
      {
        id: 'new-child',
        parent: 'new-root',
        name: '候选功能',
        summary: null,
        position: 0,
        endpoints: 0,
        endpoints_deep: 0,
      },
    ]
    c.view.placements = [
      {
        endpoint: first!.interface_id,
        folder: 'new-child',
        author: { by: 'curate', pass: 'organize', model: 'fixture' },
        at: '',
      },
    ]
    c.view.notes = [
      {
        endpoint: first!.interface_id,
        name: '候选接口名称',
        purpose: '候选用途',
        author: { by: 'curate', pass: 'describe', model: 'fixture' },
        at: '',
      },
    ]
    const preview = candidateIndex(c, official)
    const tree = documentTree(preview, null)
    expect(findFolder(tree, 'new-root')?.count).toBe(1)
    expect(findFolder(tree, 'new-child')?.entries[0]?.name).toBe('候选接口名称')
    expect(findFolder(tree, 'unplaced')?.entries.map((e) => e.interface_id)).toEqual([
      second!.interface_id,
    ])
    expect(tree.reduce((n, root) => n + root.count, 0)).toBe(2)
    expect(official).toEqual(original)
  })
  it('compares knowledge content rather than timestamps and freshness hashes', () => {
    const c = candidate()
    c.base.fields = [field()]
    c.view.fields = [
      { ...field(), at: 'later', context: { ...field().context!, input_hash: 'new' } },
    ]
    expect(candidateChanges(c)).toEqual([])
    c.view.fields[0]!.text = '记录标识；当前观测关联到详情查询参数'
    expect(candidateChanges(c)[0]).toMatchObject({
      section: 'fields',
      status: 'updated',
      title: '记录标识',
    })
  })
  it('keeps additions, removals and field locations distinct', () => {
    const c = candidate()
    c.base.fields = [field()]
    c.view.fields = [
      {
        ...field(),
        path: 'request/id',
        context: { ...field().context!, location: { in: 'request_body' } },
      },
    ]
    expect(candidateChanges(c).map((c) => c.status)).toEqual(['removed', 'added'])
  })
  it('ignores temporary command names and reviews the final directory projection', () => {
    const c = candidate()
    c.view.folders = [
      {
        id: 'root',
        parent: null,
        name: '技术咨询',
        summary: '咨询业务入口',
        position: 0,
        endpoints: 0,
        endpoints_deep: 0,
      },
    ]
    c.batches = [
      {
        id: 'batch',
        author: { by: 'curate', pass: 'organize', model: 'fixture' },
        state: 'done',
        commands: [{ do: 'put_folder', name: '__curation_temporary' }],
      },
    ]
    expect(candidateChanges(c)).toHaveLength(1)
    expect(candidateChanges(c)[0]!.title).toBe('技术咨询')
  })
})
describe('truthful progress', () => {
  it('reports API-stage progress and never invents a directory percentage', () => {
    expect(phaseProgress(job())).toBeCloseTo((45 / 47) * 100)
    expect(phaseProgress(job({ stage: 'organize' }))).toBeNull()
    expect(progressLabel(job({ status: 'failed', candidate_id: 'c' }))).toContain('保留')
  })
  it('labels a finished generation as awaiting review and computes real elapsed time', () => {
    expect(progressLabel(job({ status: 'done' }))).toContain('审阅')
    expect(elapsedLabel('2026-10-07T12:00:00Z', Date.parse('2026-10-07T12:02:15Z'))).toBe(
      '2 分 15 秒',
    )
  })
})
