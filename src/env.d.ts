/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_PROJECTS_SOURCE?: 'mock' | 'live'
  readonly VITE_PROJECTS_QUERY_API?: string
  readonly VITE_DOCUMENTS_SOURCE?: 'mock' | 'live'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
