import batch from '@/contracts/ingestion/2.2.0/fixtures/http-batch.json'
import type {
  Record as CaptureRecord,
  HttpExchange,
} from '@/contracts/ingestion/2.2.0/types.generated'
import { ApiError } from '@/api/client'
import { contractResponse } from './contract'
import {
  DOCUMENT_PAGE_SIZE,
  ENVIRONMENT_PAGE_SIZE,
  type DocumentSource,
  type ObservedDefinition,
  type InterfaceDetail,
  type InterfaceCard,
  type ProjectEnvironment,
  type ObservationDetail,
  type ObservationCard,
} from './types'

// Synthetic UI examples tied to the pinned contract; never an extractor for live traffic.
const catalog: [HttpExchange['request']['method'], string][] = [
  ['GET', '/orders'],
  ['POST', '/orders'],
  ['GET', '/orders/42'],
  ['PATCH', '/orders/42'],
  ['DELETE', '/orders/42'],
  ['GET', '/users'],
  ['GET', '/users/42'],
  ['POST', '/sessions'],
  ['GET', '/inventory'],
  ['GET', '/inventory/42'],
  ['GET', '/events'],
  ['POST', '/events'],
  ['GET', '/reports'],
  ['GET', '/reports/export'],
  ['GET', '/health'],
  ['GET', '/notifications'],
  ['PATCH', '/notifications/42'],
  ['GET', '/products'],
  ['GET', '/products/42'],
  ['POST', '/products'],
  ['GET', '/empty-list'],
  ['GET', '/nullable-value'],
  ['GET', '/partial'],
  ['GET', '/settings'],
]
function id(projectId: string, kind: number, index: number) {
  let hash = 2166136261
  for (const character of projectId) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return `${(hash >>> 0).toString(16).padStart(8, '0')}-${kind.toString(16).padStart(4, '0')}-4000-8000-${String(index + 1).padStart(12, '0')}`
}
function environments(projectId: string): ProjectEnvironment[] {
  return ['开发环境', '预发环境'].map((name, index) => ({ id: id(projectId, 1, index), name }))
}
function environment(projectId: string, environmentId: string) {
  const list = environments(projectId)
  const index = list.findIndex((item) => item.id === environmentId)
  if (index < 0) throw new ApiError('当前项目中不存在这个环境。', 'http', 404)
  return { index, value: list[index]! }
}
function row(projectId: string, environmentId: string, index: number): InterfaceCard {
  const env = environment(projectId, environmentId)
  const [method, path] = catalog[index]!
  return {
    interface_id: id(projectId, 2, index),
    method,
    path,
    environment_id: environmentId,
    revision_id: id(projectId, 3, env.index * 100 + index),
    state: 'observed',
    classification: 'unclassified',
    pending_difference_count: index === 0 ? 1 : 0,
  }
}
function find(projectId: string, interfaceId: string) {
  const index = catalog.findIndex((_, index) => id(projectId, 2, index) === interfaceId)
  if (index < 0) throw new ApiError('当前环境中没有这个接口。', 'http', 404)
  return index
}
function fixture(projectId: string, environmentId: string, index: number) {
  const env = environment(projectId, environmentId)
  const card = row(projectId, environmentId, index)
  const raw = structuredClone(batch.records[0]) as CaptureRecord
  raw.record_id = id(projectId, 6, env.index * 1000 + index * 10)
  const writing = ['POST', 'PUT', 'PATCH'].includes(card.method)
  const url = `https://api.example.test${card.path}${writing ? '' : '?page=1'}`
  raw.payload.request.method = card.method as HttpExchange['request']['method']
  raw.payload.request.url = url
  raw.payload.response.url = url
  const definition: ObservedDefinition = {
    extractor_version: 'observed-http-1',
    method: card.method,
    path: card.path,
    request: {
      parameters: writing
        ? []
        : [{ name: 'page', in: 'query', observed_schema: { type: 'string' } }],
      headers: [
        { name: 'accept', observed_schema: { type: 'string' } },
        { name: 'authorization', observed_schema: { type: 'string' } },
      ],
      body: { state: 'none', media_type: '' },
    },
    response: {
      status: 200,
      capture_state: 'complete',
      headers: [
        { name: 'content-type', observed_schema: { type: 'string' } },
        { name: 'set-cookie', observed_schema: { type: 'string' } },
      ],
      body: {
        state: 'complete',
        media_type: 'application/json',
        observed_schema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: { id: { type: 'number' }, name: { type: 'string' } },
              },
            },
          },
        },
      },
    },
    limitations: [
      'OBSERVED_ONLY_NOT_A_CONFIRMED_CONTRACT',
      'REQUEST_HEADERS_PAGE-VISIBLE',
      'RESPONSE_HEADERS_PAGE-VISIBLE',
    ],
  }
  if (writing) {
    const content = '{"name":"example"}'
    raw.payload.request.headers.entries.push(['Content-Type', 'application/json'])
    raw.payload.request.body = {
      state: 'complete',
      encoding: 'text',
      content,
      bytes: new TextEncoder().encode(content).length,
    }
    definition.request.headers.push({ name: 'content-type', observed_schema: { type: 'string' } })
    definition.request.body = {
      state: 'complete',
      media_type: 'application/json',
      observed_schema: { type: 'object', properties: { name: { type: 'string' } } },
    }
  }
  if (index === 0 && env.index === 1) {
    const content = '{"items":[{"id":1,"name":"example","region":"preview"}]}'
    raw.payload.response.body = {
      state: 'complete',
      encoding: 'text',
      content,
      bytes: new TextEncoder().encode(content).length,
    }
    definition.response.body = {
      state: 'complete',
      media_type: 'application/json',
      observed_schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                name: { type: 'string' },
                region: { type: 'string' },
              },
            },
          },
        },
      },
    }
  }
  if (card.method === 'DELETE') {
    raw.payload.response.status = 204
    raw.payload.response.body = { state: 'none', encoding: 'none', content: '', bytes: 0 }
    definition.response.status = 204
    definition.response.body = { state: 'none', media_type: 'application/json' }
  }
  if (card.path === '/empty-list' || card.path === '/nullable-value') {
    const empty = card.path === '/empty-list'
    const content = empty ? '[]' : 'null'
    raw.payload.response.body = {
      state: 'complete',
      encoding: 'text',
      content,
      bytes: content.length,
    }
    definition.response.body = {
      state: 'complete',
      media_type: 'application/json',
      observed_schema: empty ? { type: 'array', items: { unknown: true } } : { type: 'null' },
    }
    definition.limitations.push(
      empty ? 'EMPTY_ARRAY_ITEM_TYPE_UNKNOWN' : 'NULL_DOES_NOT_ESTABLISH_FIELD_TYPE',
    )
  }
  if (card.path === '/reports/export') {
    const content = 'id,name\n1,example'
    raw.payload.response.headers.entries[0] = ['Content-Type', 'text/csv']
    raw.payload.response.body = {
      state: 'complete',
      encoding: 'text',
      content,
      bytes: content.length,
    }
    definition.response.body = { state: 'complete', media_type: 'text/csv', observed_schema: null }
    definition.limitations.push('RESPONSE_NON_JSON_BODY_NOT_STRUCTURALLY_INFERRED')
  }
  if (card.path === '/partial') {
    raw.payload.response.state = 'truncated'
    raw.payload.response.body = {
      state: 'truncated',
      encoding: 'text',
      content: '{"items":[',
      bytes: new TextEncoder().encode('{"items":[').length,
    }
    definition.response.capture_state = 'truncated'
    definition.response.body = {
      state: 'truncated',
      media_type: 'application/json',
      observed_schema: null,
    }
    definition.limitations.push('RESPONSE_BODY_TRUNCATED')
  }
  const { environment_id: environmentField, ...metadata } = card
  void environmentField
  const detail: InterfaceDetail = {
    ...metadata,
    project_id: projectId,
    environment: env.value,
    definition,
    origin_ingestion_id: id(projectId, 4, env.index * 1000 + index * 10),
    created_at: '2026-09-14T10:00:00Z',
  }
  return { detail, raw, envIndex: env.index }
}
function summary(
  projectId: string,
  environmentId: string,
  index: number,
  sample: number,
): ObservationCard {
  const { detail, envIndex } = fixture(projectId, environmentId, index)
  return {
    ingestion_id: id(projectId, 4, envIndex * 1000 + index * 10 + sample),
    outcome: sample === 0 ? 'created' : sample === 1 ? 'unchanged' : 'difference_recorded',
    difference_id: sample === 2 ? id(projectId, 5, envIndex * 100 + index) : null,
    compared_revision_id: detail.revision_id,
    processed_at: `2026-09-14T10:0${sample}:00Z`,
  }
}
function pause(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    const abort = () => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, 220)
    signal.addEventListener('abort', abort, { once: true })
  })
}
export const fixtureSource: DocumentSource = {
  async environments(projectId, page, signal) {
    await pause(signal)
    const all = environments(projectId)
    return contractResponse('EnvironmentPage', {
      items: all.slice((page - 1) * ENVIRONMENT_PAGE_SIZE, page * ENVIRONMENT_PAGE_SIZE),
      page,
      limit: ENVIRONMENT_PAGE_SIZE,
      total: all.length,
    })
  },
  async interfaces(projectId, environmentId, page, query, signal) {
    await pause(signal)
    const needle = query.toLowerCase()
    const all = catalog
      .map((_, index) => row(projectId, environmentId, index))
      .filter(
        (item) =>
          !needle ||
          item.method.toLowerCase().includes(needle) ||
          item.path.toLowerCase().includes(needle),
      )
      .sort(
        (a, b) =>
          a.method.localeCompare(b.method) ||
          a.path.localeCompare(b.path) ||
          a.interface_id.localeCompare(b.interface_id),
      )
    return contractResponse('InterfacePage', {
      items: all.slice((page - 1) * DOCUMENT_PAGE_SIZE, page * DOCUMENT_PAGE_SIZE),
      total: all.length,
      page,
      limit: DOCUMENT_PAGE_SIZE,
      environment_id: environmentId,
    })
  },
  async definition(projectId, environmentId, interfaceId, signal) {
    await pause(signal)
    return contractResponse(
      'InterfaceDetail',
      fixture(projectId, environmentId, find(projectId, interfaceId)).detail,
    )
  },
  async observations(projectId, environmentId, interfaceId, page, signal) {
    await pause(signal)
    const index = find(projectId, interfaceId)
    const all = Array.from({ length: index === 0 ? 3 : 2 }, (_, sample) =>
      summary(projectId, environmentId, index, sample),
    ).reverse()
    return contractResponse('ObservationPage', {
      items: all.slice((page - 1) * DOCUMENT_PAGE_SIZE, page * DOCUMENT_PAGE_SIZE),
      total: all.length,
      page,
      limit: DOCUMENT_PAGE_SIZE,
    })
  },
  async observation(projectId, environmentId, interfaceId, ingestionId, signal) {
    await pause(signal)
    const index = find(projectId, interfaceId)
    const { detail, raw } = fixture(projectId, environmentId, index)
    const sample = Array.from({ length: index === 0 ? 3 : 2 }, (_, sample) => ({
      sample,
      card: summary(projectId, environmentId, index, sample),
    })).find((item) => item.card.ingestion_id === ingestionId)
    if (!sample) throw new ApiError('当前环境中没有这条样例。', 'http', 404)
    let proposed: ObservedDefinition | null = null
    if (sample.sample === 2) {
      proposed = structuredClone(detail.definition)
      const body = proposed.response.body
      if ('observed_schema' in body && body.observed_schema) {
        const properties = body.observed_schema.properties as Record<string, unknown>
        properties.trace_id = { type: 'string' }
      }
      const content = JSON.stringify({
        ...JSON.parse(raw.payload.response.body.content),
        trace_id: 'fixture-difference',
      })
      raw.payload.response.body.content = content
      raw.payload.response.body.bytes = new TextEncoder().encode(content).length
    }
    raw.record_id = id(
      projectId,
      6,
      environment(projectId, environmentId).index * 1000 + index * 10 + sample.sample,
    )
    raw.captured_at = `2026-09-14T10:0${sample.sample}:00Z`
    const data: ObservationDetail = {
      ingestion_id: ingestionId,
      project_id: projectId,
      environment_id: environmentId,
      interface_id: interfaceId,
      status: 'completed',
      attempts: 1,
      error_code: null,
      outcome: sample.card.outcome,
      difference_id: sample.card.difference_id,
      compared_revision_id: detail.revision_id,
      proposed_definition: proposed,
      raw_record: raw,
    }
    return contractResponse('ObservationDetail', data)
  },
}
