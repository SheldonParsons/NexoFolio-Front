import type { FieldFacts } from './types'
export type LifecycleTarget = { kind: 'folder' | 'endpoint'; id: string } | { kind: 'field'; endpoint: string; location: FieldFacts['location']; path: FieldFacts['path'] }
export interface Retirement {
  target: LifecycleTarget; reason: string; actor: { kind: string; id?: string; display_name?: string | null }; at: string; version: number; retired: boolean; folders: string[]
}
export interface DocumentLifecycle { version: number; reconciled_version: number; decisions: Retirement[]; aliases?: [string,string][] }
