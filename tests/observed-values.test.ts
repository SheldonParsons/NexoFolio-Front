import { expect, it, vi } from 'vitest'
import { api } from '@/api'
import { observedValues, observedValueJson } from '@/features/documents/observedValues'
import { phaseProgress } from '@/features/curation/progress'
const scope = {
  project: 'p/1',
  endpoint: 'e/1',
  archive: 'archive',
  field: 'response_body:200:data[]./~name',
  environment: 'env',
}
it('keeps project, field, environment and page offset when reading complete value data', async () => {
  const request = vi
    .spyOn(api, 'request')
    .mockResolvedValue({ items: [], summary: { total: 25 }, has_more: true })
  await observedValues(scope, 12)
  const [path, options] = request.mock.calls[0]!
  const [base, query] = path.split('?')
  expect(base).toBe('v1/projects/p%2F1/endpoints/e%2F1/field-values')
  const params = new URLSearchParams(query)
  expect(params.get('field')).toBe(scope.field)
  expect(params.get('environment')).toBe('env')
  expect(params.get('offset')).toBe('12')
  expect(options?.cache).toBe('no-store')
})
it.each([
  'null',
  '""',
  '0',
  'false',
  '{}',
  '[]',
  '123456789012345678901234567890',
  '1.234567890123456789',
])('copies exact typed JSON without numeric coercion: %s', async (json) => {
  vi.spyOn(api, 'request').mockResolvedValue({ json })
  expect(await observedValueJson(scope, 'value')).toBe(json)
})
it('does not count a partial saved answer as complete field coverage', () => {
  expect(
    phaseProgress({
      status: 'running',
      stage: 'fields',
      completed: 1,
      total: 1,
      generated: 1,
      unchanged: 0,
      message: null,
      fields_updated: 1,
      fields_total: 1,
      fields_in_scope: 1,
      fields_filled: 0,
      fields_confirmation: 0,
      fields_pending: 1,
    }),
  ).toBe(0)
})
