import type { DocumentEntry, DocumentIndex } from '@/features/documents/source'
import type { Candidate } from './types'

/** Overlay only this immutable candidate, without modifying the formal document index. */
export function candidateIndex(candidate: Candidate, index: DocumentIndex | null): DocumentIndex {
  const included = new Set(candidate.view.endpoints)
  const folders = new Set(candidate.view.folders.map((f) => f.id))
  const notes = new Map(candidate.view.notes.map((n) => [n.endpoint, n]))
  const placements = new Map(candidate.view.placements.map((p) => [p.endpoint, p.folder]))
  const retained = new Map<string, DocumentEntry>(
    (index?.entries ?? []).map((e) => [e.interface_id, e]),
  )
  // A canonical ID can disappear after a merge; the review keeps the original
  // frozen identity and path instead of borrowing a later current document.
  for (const facts of candidate.execution_input?.prepared.facts ?? []) {
    const summary = facts.summary
    retained.set(summary.id, {
      interface_id: summary.id,
      method: summary.method,
      path: summary.path_template,
      name: null,
      purpose: null,
      folderId: null,
      summary,
    })
  }
  const entries = [...retained.values()]
    .filter((e) => included.has(e.interface_id))
    .map((entry) => {
      const note = notes.get(entry.interface_id)
      const folder = placements.get(entry.interface_id)
      return {
        ...entry,
        name: note?.name ?? null,
        purpose: note?.purpose ?? null,
        folderId: folder && folders.has(folder) ? folder : null,
      }
    })
  return {
    catalog: {
      project_id: candidate.project_id,
      folders: candidate.view.folders,
      unplaced: entries.filter((e) => !e.folderId).length,
    },
    entries,
  }
}
