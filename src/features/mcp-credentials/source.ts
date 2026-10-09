import { api } from '@/api'

export interface McpConnection {
  transport: string
  protocol_versions: string[]
  accessible_projects: number | null
}
export const readMcpConnection = (signal?: AbortSignal) =>
  api.request<McpConnection>('v1/auth/mcp-connection', { signal, cache: 'no-store' })

export interface McpCredential {
  id: string
  name: string
  issued_at: string
  starts_at: string
  expires_at: string | null
  revoked_at: string | null
  status: 'scheduled' | 'active' | 'expired' | 'revoked'
}
export interface CredentialPage {
  items: McpCredential[]
  total: number
  page: number
  limit: number
}
export interface CreateCredential {
  name: string
  starts_at: string | null
  expires_at: string | null
}
export interface CreatedCredential {
  credential: McpCredential
  token: string
  token_type: 'Bearer'
}
const path = 'v1/auth/mcp-tokens'
export const readCredentials = (page = 1, signal?: AbortSignal) =>
  api.request<CredentialPage>(`${path}?page=${page}&limit=20`, { signal, cache: 'no-store' })
export const createCredential = (input: CreateCredential, signal?: AbortSignal) =>
  api.request<CreatedCredential>(path, { method: 'POST', json: input, signal, cache: 'no-store' })
export const revokeCredential = (id: string, signal?: AbortSignal) =>
  api.request<void>(`${path}/${encodeURIComponent(id)}`, { method: 'DELETE', signal })
