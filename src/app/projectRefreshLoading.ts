/** Called once at document bootstrap, not on client-side route navigation.
 * Address-bar Enter is a `navigate`, so Navigation Timing must not gate this path.
 */
export function projectIdForDocumentLoad(path: string) {
  const match = /^\/projects\/([^/?#]+)(?:\/|$)/.exec(path.split(/[?#]/)[0] ?? '')
  if (!match) return null
  try {
    return decodeURIComponent(match[1]!)
  } catch {
    return null
  }
}

export function createProjectRefreshLoading() {
  type Load = { projectId: string; pending: number; ready: () => void }
  let current: Load | null = null
  let idle: ReturnType<typeof setTimeout> | undefined
  function cancel() {
    clearTimeout(idle)
    idle = undefined
    current = null
  }
  function drain(load: Load) {
    if (current !== load || load.pending !== 0) return
    clearTimeout(idle)
    // Allow promise continuations and Vue's render/watch queue to start dependent requests.
    idle = setTimeout(() => {
      if (current !== load || load.pending !== 0) return
      cancel()
      load.ready()
    }, 0)
  }
  function hold() {
    const owner = current
    if (!owner) return () => {}
    clearTimeout(idle)
    owner.pending++
    let released = false
    return () => {
      if (released || current !== owner) return
      released = true
      owner.pending--
      drain(owner)
    }
  }
  function start(projectId: string, ready: () => void) {
    cancel()
    current = { projectId, ready, pending: 0 }
    // Keep the load open through authentication, route imports and the first page render.
    return hold()
  }
  function request(path: string) {
    if (!current) return undefined
    const clean = path.replace(/^\//, '').split(/[?#]/)[0]!
    const prefix = `v1/projects/${encodeURIComponent(current.projectId)}`
    if (clean !== 'v1/auth/me' && clean !== prefix && !clean.startsWith(`${prefix}/`))
      return undefined
    return hold()
  }
  async function task<T>(operation: () => Promise<T>): Promise<T> {
    const release = hold()
    try {
      return await operation()
    } finally {
      release()
    }
  }
  return { start, request, task, cancel }
}

export const projectRefreshLoading = createProjectRefreshLoading()
