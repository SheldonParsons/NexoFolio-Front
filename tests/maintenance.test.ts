import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { ApiError } from '../src/api/client'
import {
  coveragePresentation,
  diffText,
  revisionState,
  sampleText,
} from '../src/features/maintenance/presentation'
import { createEvidenceReader } from '../src/features/maintenance/evidence'
import { useEvidence } from '../src/features/maintenance/useEvidence'
import { useRebuildRequest } from '../src/features/maintenance/useRebuildRequest'
import { useMaintenanceWorkspace } from '../src/features/maintenance/useMaintenanceWorkspace'
import type { EvidenceRef, TaskProgress } from '../src/features/maintenance/models'
import type { RebuildRequest } from '../src/features/maintenance/ports'

const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
})
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
  await nextTick()
}
const evidence: EvidenceRef = { id: 'evidence', projectId: 'project', kind: 'text', label: '原文' }
function evidenceReader(fetcher = vi.fn(), overrides = {}) {
  return createEvidenceReader({
    baseUrl: '/api',
    origin: 'http://127.0.0.1:5173',
    pathFor: (projectId, id) =>
      `test-only/${encodeURIComponent(projectId)}/${encodeURIComponent(id)}`,
    getAccessToken: () => 'test-token',
    maxBytes: 128,
    fetcher,
    ...overrides,
  })
}

describe('semantic evidence boundaries', () => {
  it('keeps unknown coverage distinct from zero and never infers completion from percentage', () => {
    expect(
      coveragePresentation({
        total: null,
        reviewed: null,
        missing: null,
        failed: null,
        complete: null,
      }),
    ).toMatchObject({ complete: false, ratio: null })
    expect(
      coveragePresentation({ total: 10, reviewed: 10, missing: 1, failed: 0, complete: true })
        .complete,
    ).toBe(false)
    expect(
      coveragePresentation({ total: 10, reviewed: 10, missing: 0, failed: 0, complete: false })
        .complete,
    ).toBe(false)
    expect(
      coveragePresentation({ total: 10, reviewed: 10, missing: 0, failed: 0, complete: true })
        .complete,
    ).toBe(true)
  })
  it('distinguishes missing fields, null, false, zero and an empty string', () => {
    const values = [
      { kind: 'missing' },
      { kind: 'null' },
      { kind: 'value', value: false },
      { kind: 'value', value: 0 },
      { kind: 'value', value: '' },
    ] as const
    expect(new Set(values.map(sampleText)).size).toBe(5)
    expect(diffText({ present: false })).not.toBe(diffText({ present: true, value: null }))
  })
  it('marks stale revisions and leaves missing revision checks unknown', () => {
    expect(revisionState({ boundRevision: 'a', currentRevision: 'b' })).toBe('stale')
    expect(revisionState({ boundRevision: 'a', currentRevision: null })).toBe('unknown')
    expect(revisionState({ boundRevision: 'a', currentRevision: 'a' })).toBe('current')
  })
})

describe('authenticated evidence transport', () => {
  it('fetches raw HTML as inert text with project-bound credentials and no redirects', async () => {
    const html = '<script>doNotExecute()</script>'
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(html, { headers: { 'Content-Type': 'text/html' } }))
    expect(
      await evidenceReader(fetcher).read('project', evidence, new AbortController().signal),
    ).toEqual({ kind: 'text', text: html })
    expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:5173/api/test-only/project/evidence')
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      method: 'GET',
      cache: 'no-store',
      redirect: 'error',
      headers: { Authorization: 'Bearer test-token' },
    })
  })
  it('rejects another project and unsafe path before fetching', async () => {
    const fetcher = vi.fn()
    await expect(
      evidenceReader(fetcher).read('other', evidence, new AbortController().signal),
    ).rejects.toMatchObject({ kind: 'invalid-response' })
    for (const path of [
      'https://foreign.invalid/evidence',
      '../evidence',
      '%2e%2e/evidence',
      '//foreign.invalid',
    ])
      await expect(
        evidenceReader(fetcher, { pathFor: () => path }).read(
          'project',
          evidence,
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ kind: 'invalid-response' })
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('enforces authentication and does not fall back to cached evidence on 403', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 403 }))
    await expect(
      evidenceReader(fetcher, { getAccessToken: () => undefined }).read(
        'project',
        evidence,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ status: 401 })
    expect(fetcher).not.toHaveBeenCalled()
    await expect(
      evidenceReader(fetcher).read('project', evidence, new AbortController().signal),
    ).rejects.toMatchObject({ status: 403 })
  })
  it('rejects oversized chunked evidence instead of showing a silently truncated sample', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response('x'.repeat(129), { headers: { 'Content-Type': 'text/plain' } }),
      )
    await expect(
      evidenceReader(fetcher).read('project', evidence, new AbortController().signal),
    ).rejects.toThrow('超过预览大小限制')
  })
  it('rejects SVG/HTML screenshot payloads', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } }))
    await expect(
      evidenceReader(fetcher).read(
        'project',
        { ...evidence, kind: 'screenshot' },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ kind: 'invalid-response' })
  })
})

describe('evidence viewer lifetime', () => {
  it('revokes screenshot URLs on close and suppresses late responses', async () => {
    const scope = effectScope()
    scopes.push(scope)
    const reference = ref<EvidenceRef | null>({ ...evidence, kind: 'screenshot' })
    let release!: (value: unknown) => void
    const reader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({ kind: 'screenshot', blob: new Blob(['image']) })
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              release = resolve
            }),
        ),
    }
    const urls = { createObjectURL: vi.fn().mockReturnValue('blob:test'), revokeObjectURL: vi.fn() }
    const viewer = scope.run(() =>
      useEvidence(
        () => 'project',
        () => reference.value,
        reader,
        vi.fn(),
        urls,
      ),
    )!
    await flush()
    expect(viewer.imageUrl.value).toBe('blob:test')
    reference.value = { ...evidence, id: 'another' }
    await flush()
    expect(urls.revokeObjectURL).toHaveBeenCalledWith('blob:test')
    reference.value = null
    await flush()
    release({ kind: 'text', text: 'late' })
    await flush()
    expect(viewer.text.value).toBe('')
    expect(viewer.imageUrl.value).toBe('')
  })
})

describe('explicit maintenance initiation', () => {
  it('never starts on mount/read and retries only with the original request key', async () => {
    const scope = effectScope()
    scopes.push(scope)
    const saved = new Map<string, RebuildRequest>()
    const store = {
      read: (id: string) => saved.get(id) ?? null,
      save: (r: RebuildRequest) => {
        saved.set(r.projectId, r)
      },
      clear: (id: string) => {
        saved.delete(id)
      },
    }
    const port = {
      start: vi
        .fn()
        .mockRejectedValueOnce(new ApiError('timeout', 'timeout'))
        .mockResolvedValue({ projectId: 'p', taskId: 'task' }),
    }
    const accepted = vi.fn()
    const command = scope.run(() => useRebuildRequest(() => 'p', port, store, accepted, vi.fn()))!
    expect(port.start).not.toHaveBeenCalled()
    await command.requestRebuild()
    const original = port.start.mock.calls[0]?.[0]
    expect(original).not.toHaveProperty('strategy')
    await command.requestRebuild()
    expect(port.start).toHaveBeenCalledTimes(1)
    await command.retry()
    expect(port.start.mock.calls[1]?.[0]).toEqual(original)
    expect(accepted).toHaveBeenCalledWith({ projectId: 'p', taskId: 'task' })
  })
  it('read coordination ignores another task response after selection', async () => {
    const scope = effectScope()
    scopes.push(scope)
    let release!: (value: TaskProgress) => void
    const port = {
      task: vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              release = resolve
            }),
        )
        .mockResolvedValue({ projectId: 'p', id: 'new' }),
      candidate: vi.fn(),
      semantics: vi.fn(),
    }
    const workspace = scope.run(() => useMaintenanceWorkspace(() => 'p', port, vi.fn()))!
    expect(port.task).not.toHaveBeenCalled()
    const first = workspace.loadTask('old')
    await workspace.loadTask('new')
    release({ projectId: 'p', id: 'old' } as TaskProgress)
    await first
    expect(workspace.task.value?.id).toBe('new')
  })
  it('rejects semantic data from another environment', async () => {
    const scope = effectScope()
    scopes.push(scope)
    const port = {
      task: vi.fn(),
      candidate: vi.fn(),
      semantics: vi
        .fn()
        .mockResolvedValue({
          projectId: 'p',
          interfaceId: 'i',
          environmentId: 'other',
          fields: [],
        }),
    }
    const workspace = scope.run(() => useMaintenanceWorkspace(() => 'p', port, vi.fn()))!
    await workspace.loadSemantics('i', 'env')
    expect(workspace.semantics.value).toBeNull()
    expect(workspace.errors.value.semantics).toContain('不匹配')
  })
})
