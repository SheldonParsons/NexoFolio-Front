import { createApiClient } from './client'

/** Future feature API modules use this client; backend contracts are not guessed here. */
export const api = createApiClient({ baseUrl: import.meta.env.VITE_API_BASE_URL || '/api' })
export { ApiError } from './client'
