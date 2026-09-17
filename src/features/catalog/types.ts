import type { InterfaceMergeGroup } from '@/contracts/catalog-preview/1.4.0/types.generated'
import type { CatalogAttempt, CatalogReceipt } from './change'

// Presentation models. The adapter maps validated generated contracts into these records.
export interface CatalogDirectory {
  id: string
  parent: string | null
  name: string
  description: string
  count: number
  system: boolean
}
export interface MenuBranch {
  directory: CatalogDirectory
  children: MenuBranch[]
}
export interface CatalogState {
  projectId: string
  name: string
  generation: number
  versionId: string | null
  sourceTaskId: string | null
  sourceRunId?: string | null
  unclassifiedId: string
  nodes: CatalogDirectory[]
  groups: InterfaceMergeGroup[]
  total: number
}
export interface LiveCatalogInterface {
  id: string
  method: string
  path: string
  environments: { id: string; name: string; revisionId: string }[]
}
export interface CatalogInterfacePage {
  items: LiveCatalogInterface[]
  total: number
  page: number
  limit: number
  generation: number
}
export interface CatalogVersion {
  id: string
  taskId: string | null
  runId: string | null
  createdAt: string
}
export interface CatalogVersionPage {
  items: CatalogVersion[]
  total: number
  page: number
  limit: number
}
export interface CatalogSource {
  current(projectId: string, signal: AbortSignal): Promise<CatalogState>
  interfaces(
    projectId: string,
    directoryId: string,
    page: number,
    generation: number,
    signal: AbortSignal,
  ): Promise<CatalogInterfacePage>
  versions(projectId: string, page: number, signal: AbortSignal): Promise<CatalogVersionPage>
  change(projectId: string, attempt: CatalogAttempt, signal: AbortSignal): Promise<CatalogReceipt>
}
