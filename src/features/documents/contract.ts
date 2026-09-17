import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import schema from '@/contracts/documents/2.2.0/responses.schema.json'
import environmentSchema from '@/contracts/ingestion/2.2.0/environment-page.schema.json'
import assessmentPageSchema from '@/contracts/documents/2.2.0/assessment-page.schema.json'
import type { ObservationAssessmentPage } from '@/contracts/documents/2.2.0/types.generated'
import { ApiError } from '@/api/client'
import type {
  InterfacePage,
  InterfaceDetail,
  ObservationPage,
  ObservationDetail,
  EnvironmentPage,
} from './types'

interface Responses {
  ObservationAssessmentPage: ObservationAssessmentPage
  InterfacePage: InterfacePage
  InterfaceDetail: InterfaceDetail
  ObservationPage: ObservationPage
  ObservationDetail: ObservationDetail
  EnvironmentPage: EnvironmentPage
}
const ajv = new Ajv2020({ allErrors: false, strict: true })
addFormats(ajv)
ajv.addFormat('uint32', { type: 'number', validate: (value: number) => Number.isInteger(value) && value >= 0 && value <= 4294967295 })
ajv.addFormat('int64', { type: 'number', validate: Number.isSafeInteger })
const validators = {
  ObservationAssessmentPage: ajv.compile(assessmentPageSchema),
  InterfacePage: ajv.compile({ ...schema, $ref: '#/$defs/InterfacePage' }),
  InterfaceDetail: ajv.compile({ ...schema, $ref: '#/$defs/InterfaceDetail' }),
  ObservationPage: ajv.compile({ ...schema, $ref: '#/$defs/ObservationPage' }),
  ObservationDetail: ajv.compile({ ...schema, $ref: '#/$defs/ObservationDetail' }),
  EnvironmentPage: ajv.compile(environmentSchema),
}
export function contractResponse<K extends keyof Responses>(kind: K, value: unknown): Responses[K] {
  if (!validators[kind](value))
    throw new ApiError('服务响应与当前文档契约不一致，请核对接口版本。', 'invalid-response')
  return value as Responses[K]
}
export function requireBinding(condition: boolean) {
  if (!condition)
    throw new ApiError('响应与当前项目、环境或接口不匹配，请重新读取。', 'invalid-response')
}
