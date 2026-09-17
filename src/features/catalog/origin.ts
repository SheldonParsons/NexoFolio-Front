export function catalogOrigin(
  projectId: string,
  source: { taskId?: string | null; runId?: string | null },
) {
  const base = `/projects/${encodeURIComponent(projectId)}`
  if (source.runId)
    return {
      label: '知识重构任务',
      to: `${base}/maintenance?${new URLSearchParams({ run: source.runId })}`,
    }
  if (source.taskId)
    return {
      label: '目录候选任务',
      to: `${base}/catalog-preview?${new URLSearchParams({ task: source.taskId })}`,
    }
  return null
}
