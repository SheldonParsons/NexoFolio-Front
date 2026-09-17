export type {
  ObservedDefinition,
  InterfaceCard,
  InterfacePage,
  InterfaceDetail,
  ObservationCard,
  ObservationPage,
  ObservationDetail,
} from '@/contracts/documents/2.2.0/types.generated'
export type {
  ProjectEnvironment,
  EnvironmentPage,
} from '@/contracts/ingestion/2.2.0/types.generated'

import type { EnvironmentPage } from '@/contracts/ingestion/2.2.0/types.generated'
import type {
  InterfacePage,
  InterfaceDetail,
  ObservationPage,
  ObservationDetail,
} from '@/contracts/documents/2.2.0/types.generated'

export interface DocumentSource {
  environments(projectId: string, page: number, signal: AbortSignal): Promise<EnvironmentPage>
  interfaces(
    projectId: string,
    environmentId: string,
    page: number,
    query: string,
    signal: AbortSignal,
  ): Promise<InterfacePage>
  definition(
    projectId: string,
    environmentId: string,
    interfaceId: string,
    signal: AbortSignal,
  ): Promise<InterfaceDetail>
  observations(
    projectId: string,
    environmentId: string,
    interfaceId: string,
    page: number,
    signal: AbortSignal,
  ): Promise<ObservationPage>
  observation(
    projectId: string,
    environmentId: string,
    interfaceId: string,
    ingestionId: string,
    signal: AbortSignal,
  ): Promise<ObservationDetail>
}
export const DOCUMENT_PAGE_SIZE = 20
export const ENVIRONMENT_PAGE_SIZE = 100
