function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}
export function schemaType(value: unknown): string {
  const schema = object(value)
  if (!schema || schema.unknown === true) return 'unknown'
  if (typeof schema.type === 'string') return schema.type
  if (Array.isArray(schema.type))
    return schema.type.filter((item) => typeof item === 'string').join(' | ') || 'unknown'
  if (Array.isArray(schema.anyOf)) return '多种观测形态'
  return '未标注类型'
}
export interface SchemaRow {
  path: string
  label: string
  type: string
  note: string
  depth: number
}
export function schemaRows(value: unknown) {
  const rows: SchemaRow[] = []
  let truncated = false
  function walk(input: unknown, path: string, label: string, depth: number) {
    if (rows.length >= 400 || depth > 32) {
      truncated = true
      return
    }
    const schema = object(input)
    const type = schemaType(input)
    rows.push({
      path,
      label,
      type,
      depth,
      note:
        type === 'null'
          ? '仅观测到 null，不能确定其他类型'
          : type === 'unknown'
            ? '观测不足或达到提取限制'
            : '',
    })
    if (!schema) return
    const properties = object(schema.properties)
    if (properties) {
      for (const [key, child] of Object.entries(properties)) {
        walk(child, `${path}[${JSON.stringify(key)}]`, key, depth + 1)
        if (rows.length >= 400) {
          truncated = true
          break
        }
      }
    }
    if (schema.items !== undefined) walk(schema.items, `${path}[]`, '[]', depth + 1)
    if (Array.isArray(schema.anyOf)) {
      for (const [index, child] of schema.anyOf.entries()) {
        walk(child, `${path} / anyOf[${index}]`, `观测形态 ${index + 1}`, depth + 1)
        if (rows.length >= 400) {
          truncated = true
          break
        }
      }
    }
  }
  walk(value, '$', '$', 0)
  return { rows, truncated }
}
