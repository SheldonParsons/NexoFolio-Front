import type { DocumentIndex } from '@/features/documents/source'
import type { Candidate } from './types'

/** Overlay only this immutable candidate, without modifying the formal document index. */
export function candidateIndex(candidate: Candidate, index: DocumentIndex | null): DocumentIndex {
  const included = new Set(candidate.view.endpoints)
  const folders = new Set(candidate.view.folders.map((f) => f.id))
  const notes = new Map(candidate.view.notes.map((n) => [n.endpoint, n]))
  const placements = new Map(candidate.view.placements.map((p) => [p.endpoint, p.folder]))
  const entries = (index?.entries ?? [])
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
