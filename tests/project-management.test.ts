import { describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../src/stores/auth'
import { authenticatedUser } from '../src/api/auth'
import { createProjectManagement } from '../src/features/projects/management/api'
const source = {
  project_id: '10000000-0000-4000-8000-000000000001',
  name: '云售后',
  status: 'doing',
}
const user = (account: string) => ({
  id: 'fixture',
  account,
  display_name: 'fixture',
  enabled: true,
})
describe('project management capabilities', () => {
  it('retains verified capabilities through a same-account profile refresh and clears them for a changed identity', () => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.user = authenticatedUser(user('A80646'), { manage_projects: true })
    auth.updateProfile({ ...user('a80646'), display_name: '修改后的名称' })
    expect(auth.canManageProjects).toBe(true)
    auth.updateProfile(user('member'))
    expect(auth.canManageProjects).toBe(false)
    auth.updateProfile({ ...user('a80646'), can_manage_projects: true })
    expect(auth.canManageProjects).toBe(false)
  })
  it('requires the server capability and the authenticated enabled account', () => {
    expect(authenticatedUser(user('A80646'), { manage_projects: true }).can_manage_projects).toBe(
      true,
    )
    expect(authenticatedUser(user('a80646'), { manage_projects: true }).can_manage_projects).toBe(
      true,
    )
    expect(authenticatedUser(user('a80646')).can_manage_projects).toBeUndefined()
    expect(
      authenticatedUser(user('member'), { manage_projects: true }).can_manage_projects,
    ).toBeUndefined()
    expect(
      authenticatedUser({ ...user('a80646'), can_manage_projects: true }).can_manage_projects,
    ).toBeUndefined()
    expect(() =>
      authenticatedUser({ ...user('a80646'), enabled: false }, { manage_projects: true }),
    ).toThrow()
  })
})
describe('project management API', () => {
  it('reads all permission-source pages and rejects inconsistent or duplicate continuation', async () => {
    const second = { ...source, project_id: '10000000-0000-4000-8000-000000000002' }
    const request = vi
      .fn()
      .mockResolvedValueOnce({ items: [source], total: 2, page: 1, limit: 100 })
      .mockResolvedValueOnce({ items: [second], total: 2, page: 2, limit: 100 })
    const signal = new AbortController().signal
    expect(await createProjectManagement(request).sources(signal)).toEqual([source, second])
    expect(request.mock.calls[1]?.[0]).toContain('page=2')
    request
      .mockResolvedValueOnce({ items: [source], total: 2, page: 1, limit: 100 })
      .mockResolvedValueOnce({ items: [source], total: 2, page: 2, limit: 100 })
    await expect(createProjectManagement(request).sources(signal)).rejects.toMatchObject({
      kind: 'invalid-response',
    })
  })
  it('does not report creation success for a different name or permission source', async () => {
    const request = vi.fn().mockResolvedValue({
      project_id: source.project_id,
      name: '错误的项目',
      permission_source: source,
      permission_sources: [source],
      revision: 1,
    })
    await expect(
      createProjectManagement(request).create(
        '巴西售后',
        [source.project_id],
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ kind: 'invalid-response' })
  })
  it('creates a project with all selected sources and rejects empty or duplicate bindings before dispatch', async () => {
    const second = { ...source, project_id: '10000000-0000-4000-8000-000000000002' }
    const request = vi.fn().mockResolvedValue({
      project_id: source.project_id,
      name: '巴西售后',
      permission_sources: [second, source],
      revision: 1,
    })
    const api = createProjectManagement(request),
      signal = new AbortController().signal
    await api.create('巴西售后', [source.project_id, second.project_id], signal)
    expect(request.mock.calls[0]?.[1].json).toEqual({
      name: '巴西售后',
      permission_source_project_ids: [source.project_id, second.project_id],
    })
    request.mockClear()
    for (const ids of [[], [source.project_id, source.project_id]])
      await expect(api.create('巴西售后', ids, signal)).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  })
  it('edits the selected project with its revision and validates the complete returned identity and bindings', async () => {
    const value = {
      project_id: source.project_id,
      name: '新的名称',
      permission_sources: [source],
      revision: 2,
    }
    const request = vi.fn().mockResolvedValue(value),
      signal = new AbortController().signal
    const api = createProjectManagement(request)
    await api.edit(source.project_id, value.name, [source.project_id], 1, signal)
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      method: 'PATCH',
      json: { name: value.name, permission_source_project_ids: [source.project_id], revision: 1 },
    })
    request.mockResolvedValue({ ...value, revision: 1 })
    await expect(
      api.edit(source.project_id, value.name, [source.project_id], 1, signal),
    ).rejects.toMatchObject({ kind: 'invalid-response' })
    request.mockResolvedValue({ ...value, permission_sources: [source, source] })
    await expect(
      api.edit(source.project_id, value.name, [source.project_id], 1, signal),
    ).rejects.toThrow()
  })
  it('submits a destructive action exactly once with explicit project-name confirmation', async () => {
    const request = vi.fn().mockResolvedValue({ cleared: { interfaces: 12 } })
    await createProjectManagement(request).clear(
      source.project_id,
      '云售后',
      new AbortController().signal,
    )
    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      json: { confirmation: '云售后' },
      timeoutMs: 60000,
    })
  })
  it('refuses a malformed project identifier before issuing any request', async () => {
    const request = vi.fn()
    await expect(
      createProjectManagement(request).clear('../other', '云售后', new AbortController().signal),
    ).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  })
})
