import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import run from '@/contracts/maintenance/2.0.0/run.schema.json'
import page from '@/contracts/maintenance/2.0.0/page.schema.json'
import snapshot from '@/contracts/maintenance/2.0.0/snapshot.schema.json'
import knowledge from '@/contracts/maintenance/2.0.0/interface-knowledge.schema.json'
import versions from '@/contracts/maintenance/2.0.0/versions.schema.json'
import activation from '@/contracts/maintenance/2.0.0/activation.schema.json'
import start from '@/contracts/maintenance/2.0.0/start.schema.json'
import publish from '@/contracts/maintenance/2.0.0/publish.schema.json'
import restore from '@/contracts/maintenance/2.0.0/restore.schema.json'
import observation from '@/contracts/capture/1.2.0/observation.schema.json'
import facts from '@/contracts/capture/1.2.0/evidence-page.schema.json'
import fact from '@/contracts/capture/1.2.0/evidence.schema.json'
import checkpoints from '@/contracts/maintenance/2.0.0/checkpoints.schema.json'
import official from '@/contracts/catalog-preview/1.4.0/official.schema.json'
import officialInterfaces from '@/contracts/catalog-preview/1.4.0/official-interfaces.schema.json'
import type {
  OfficialCatalog,
  OfficialInterfacePage,
} from '@/contracts/catalog-preview/1.4.0/types.generated'
import type {
  MaintenanceRun,
  MaintenancePage,
  KnowledgeSnapshot,
  InterfaceKnowledge,
  KnowledgeVersionPage,
  KnowledgeActivation,
  StartMaintenance,
  PublishKnowledge,
  RestoreKnowledge,
  MaintenanceCheckpointPage,
} from '@/contracts/maintenance/2.0.0/types.generated'
import type {
  CaptureObservation,
  EvidencePage,
  EvidenceFact,
} from '@/contracts/capture/1.2.0/types.generated'
import { ApiError } from '@/api/client'

const ajv = new Ajv2020({ strict: true, allErrors: false })
addFormats(ajv)
ajv.addFormat('uint', {
  type: 'number',
  validate: (n: number) => Number.isSafeInteger(n) && n >= 0,
})
ajv.addFormat('uint32', {
  type: 'number',
  validate: (n: number) => Number.isInteger(n) && n >= 0 && n <= 4294967295,
})
ajv.addFormat('uint64', {
  type: 'number',
  validate: (n: number) => Number.isSafeInteger(n) && n >= 0,
})
ajv.addFormat('int64', { type: 'number', validate: Number.isSafeInteger })
ajv.addFormat('double', { type: 'number', validate: Number.isFinite })
interface Responses {
  fact: EvidenceFact
  checkpoints: MaintenanceCheckpointPage
  run: MaintenanceRun
  page: MaintenancePage
  snapshot: KnowledgeSnapshot
  knowledge: InterfaceKnowledge
  versions: KnowledgeVersionPage
  activation: KnowledgeActivation
  observation: CaptureObservation
  facts: EvidencePage
  official: OfficialCatalog
  officialInterfaces: OfficialInterfacePage
}
const validators = {
  fact: ajv.compile(fact),
  checkpoints: ajv.compile(checkpoints),
  run: ajv.compile(run),
  page: ajv.compile(page),
  snapshot: ajv.compile(snapshot),
  knowledge: ajv.compile(knowledge),
  versions: ajv.compile(versions),
  activation: ajv.compile(activation),
  observation: ajv.compile(observation),
  facts: ajv.compile(facts),
  official: ajv.compile(official),
  officialInterfaces: ajv.compile(officialInterfaces),
}
export const validateStart = ajv.compile<StartMaintenance>(start)
export const validatePublish = ajv.compile<PublishKnowledge>(publish)
export const validateRestore = ajv.compile<RestoreKnowledge>(restore)
export function maintenanceResponse<K extends keyof Responses>(
  kind: K,
  value: unknown,
): Responses[K] {
  if (!validators[kind](value))
    throw new ApiError('维护服务响应与已固定的合同不匹配。', 'invalid-response')
  return value as Responses[K]
}
export function binding(condition: boolean) {
  if (!condition) throw new ApiError('维护响应与当前项目、任务或环境不匹配。', 'invalid-response')
}
