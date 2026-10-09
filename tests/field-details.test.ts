import { expect, it } from 'vitest'
import { splitFieldDetails, fieldStructureLines } from '@/features/documents/fieldDetails'
import type { FieldNote, FieldFacts } from '@/contracts/knowledge/types'
const note: FieldNote = {
  endpoint: 'e',
  path: 'response_body:200:data.id',
  text: '记录标识',
  values: [],
  context: {
    location: { in: 'response_body', status: 200 },
    field_path: 'data.id',
    input_hash: null,
    evidence: [],
    meaning: {
      details: ['位置：response_body', '兄弟字段：data.name', '当前观测到该标识用于详情查询'],
      unknowns: ['标识是否全局唯一待确认'],
    },
  },
}
it('separates structural metadata from business meaning without discarding either', () => {
  const parts = splitFieldDetails(note)
  expect(parts.business).toEqual(['当前观测到该标识用于详情查询'])
  expect(parts.technical).toEqual(['位置：response_body', '兄弟字段：data.name'])
  expect(parts.business.length + parts.technical.length).toBe(
    note.context!.meaning!.details!.length,
  )
})
it('uses actual field facts and only same-location siblings for technical context', () => {
  const field: FieldFacts = {
    location: { in: 'response_body', status: 200 },
    path: ['data', 'id'],
    types: ['number'],
    labels: [],
    differs_between_environments: false,
    declared: null,
    conflict: null,
  }
  const lines = fieldStructureLines(
    field,
    [
      field,
      { ...field, path: ['data', 'name'] },
      { ...field, location: { in: 'request_body' }, path: ['data', 'requestOnly'] },
    ],
    note,
  )
  expect(lines).toContainEqual(['同级字段', 'data.name'])
  expect(lines.some((line) => line[1]?.includes('requestOnly'))).toBe(false)
})
