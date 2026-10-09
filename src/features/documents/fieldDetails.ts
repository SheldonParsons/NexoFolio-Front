import type { FieldFacts, FieldNote } from '@/contracts/knowledge/types'
import { fieldPath } from '@/features/knowledge/fieldPresentation'
const structural = /^(位置|父级结构|兄弟字段|类型|来源)[：:]/
export function splitFieldDetails(note: FieldNote) {
  const details = note.context?.meaning?.details ?? []
  return {
    business: details.filter((s) => !structural.test(s)),
    technical: details.filter((s) => structural.test(s)),
  }
}
export function fieldStructureLines(
  field: FieldFacts | undefined,
  fields: FieldFacts[],
  note: FieldNote,
) {
  if (!field) return []
  const parent = field.path.slice(0, -1)
  const sameLocation = (other: FieldFacts) =>
    JSON.stringify(other.location) === JSON.stringify(field.location)
  const parentKey = JSON.stringify(parent)
  const siblings = fields
    .filter(
      (f) =>
        sameLocation(f) &&
        JSON.stringify(f.path.slice(0, -1)) === parentKey &&
        JSON.stringify(f.path) !== JSON.stringify(field.path),
    )
    .map((f) => fieldPath(f.path))
  const location =
    {
      path: '路径参数',
      query: '查询参数',
      request_header: '请求 Header',
      response_header: '响应 Header',
      request_body: '请求体',
      response_body: '响应体',
    }[field.location.in] +
    (field.location.in === 'response_body' || field.location.in === 'response_header'
      ? ` · ${field.location.status}`
      : '')
  return [
    ['位置', location],
    ['观测类型', field.types.join(' | ')],
    ['父级结构', parent.length ? fieldPath(parent) : '报文根节点'],
    ...(siblings.length ? [['同级字段', siblings.join('、')]] : []),
    ...(note.context?.meaning?.role ? [['结构角色', note.context.meaning.role]] : []),
  ]
}
