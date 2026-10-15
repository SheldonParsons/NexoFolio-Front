/** A reply may write state only while its request still owns its slot and project. */
export type DocumentRequestSlot =
  | 'project'
  | 'detail'
  | 'sample'
  | 'curate'
  | 'curate-submit'
  | 'curate-stop'
export type DocumentRequest = { signal: AbortSignal; current: () => boolean }

export function documentRequests(projectId: () => string) {
  const active = new Map<DocumentRequestSlot, AbortController>()
  function cancel(slot: DocumentRequestSlot) {
    active.get(slot)?.abort()
    active.delete(slot)
  }
  function begin(slot: DocumentRequestSlot): DocumentRequest {
    cancel(slot)
    const controller = new AbortController()
    const pid = projectId()
    active.set(slot, controller)
    return {
      signal: controller.signal,
      current: () =>
        !controller.signal.aborted && active.get(slot) === controller && projectId() === pid,
    }
  }
  function cancelAll() {
    for (const slot of active.keys()) cancel(slot)
  }
  return { begin, cancel, cancelAll }
}
export type DocumentRequests = ReturnType<typeof documentRequests>
export type DocumentErrorReporter = (cause: unknown, target: { value: string }) => void
