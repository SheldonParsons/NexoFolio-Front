import type { MaintenanceCandidate, SemanticDocument, TaskProgress } from './models'

/** Application-facing ports. Final generated contracts must be validated/mapped in an adapter. */
export interface MaintenanceReads {
  task(projectId: string, taskId: string, signal: AbortSignal): Promise<TaskProgress>
  candidate(
    projectId: string,
    candidateId: string,
    signal: AbortSignal,
  ): Promise<MaintenanceCandidate>
  semantics(
    projectId: string,
    interfaceId: string,
    environmentId: string,
    signal: AbortSignal,
  ): Promise<SemanticDocument>
}
export interface RebuildRequest {
  projectId: string
  requestKey: string
}
export interface RebuildReceipt {
  projectId: string
  taskId: string
}
export interface RebuildPort {
  /** Adapter must preserve requestKey for an uncertain retry. No full/local strategy input. */
  start(request: RebuildRequest, signal: AbortSignal): Promise<RebuildReceipt>
}
export interface RebuildAttemptStore {
  read(projectId: string): RebuildRequest | null
  save(request: RebuildRequest): void
  clear(projectId: string): void
}
