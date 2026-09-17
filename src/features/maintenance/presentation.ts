import type { DiffValue, SampleValue, SemanticField, TaskProgress } from './models'
export function phaseLabel(phase: string) {
  if (phase === 'index') return '构建完整索引'
  if (phase === 'index_read') return '读取目录与字段索引'
  return phase
}
export const basisLabels = {
  observed: '观察',
  inferred: '推断',
  'review-needed': '待复核',
} as const
export const workLabels = {
  pending: '等待中',
  running: '进行中',
  complete: '已完成',
  failed: '失败',
  missing: '缺失',
  unknown: '尚未提供',
} as const
export const taskLabels = {
  queued: '等待执行',
  running: '重构中',
  ready: '候选可审阅',
  incomplete: '审阅不完整',
  failed: '任务失败',
} as const
export const changeLabels = {
  directory: '目录变更',
  description: '参数描述',
  'source-relation': '参数来源关系',
  'enum-label': '枚举标签',
  'enum-scope': '枚举观察范围',
} as const
export function revisionState(
  field: Pick<SemanticField, 'boundRevision' | 'currentRevision' | 'stale'>,
) {
  if (field.stale !== undefined) return field.stale ? 'stale' : 'current'
  if (!field.boundRevision || !field.currentRevision) return 'unknown'
  return field.boundRevision === field.currentRevision ? 'current' : 'stale'
}
export function jsonText(value: unknown) {
  return JSON.stringify(value, null, 2) ?? '未提供值'
}
export function sampleText(sample: SampleValue) {
  if (sample.kind === 'unknown') return '状态未知（不能判断是否传入）'
  if (sample.kind === 'missing') return '未传（字段不存在）'
  if (sample.kind === 'null') return 'null（显式空值）'
  return jsonText(sample.value)
}
export function diffText(value: DiffValue) {
  return value.present
    ? jsonText(value.value)
    : value.known === false
      ? '尚未读取比较基线'
      : '不存在 / 未提供'
}
export function coveragePresentation(coverage: TaskProgress['coverage']) {
  const { total, reviewed, missing, failed } = coverage
  const numbers = [total, reviewed, missing, failed]
  const valid = numbers.every(
    (value) => value !== null && Number.isSafeInteger(value) && value >= 0,
  )
  const complete =
    valid && coverage.complete === true && reviewed === total && missing === 0 && failed === 0
  const ratio =
    total !== null &&
    reviewed !== null &&
    Number.isSafeInteger(total) &&
    Number.isSafeInteger(reviewed) &&
    total > 0 &&
    reviewed >= 0
      ? Math.min(100, Math.floor((reviewed / total) * 100))
      : null
  return {
    complete,
    ratio,
    text: complete ? '全量字段审阅已完成' : '全量字段审阅尚未完成或缺少确认',
  }
}
