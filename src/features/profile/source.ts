import { api } from '@/api'
import type { UserProfile } from '@/api/auth'
export interface PersonalProfile {
  user: UserProfile
  account_display_name: string
  display_name_override: string | null
  bio: string
  version: number
  created_at: string
  last_login_at: string
}
export const readProfile = (signal?: AbortSignal) =>
  api.request<PersonalProfile>('v1/auth/profile', { signal, cache: 'no-store' })
export const updateProfile = (
  display_name: string | null,
  bio: string,
  version: number,
  signal?: AbortSignal,
) =>
  api.request<PersonalProfile>('v1/auth/profile', {
    method: 'PUT',
    json: { display_name, bio, version },
    signal,
  })
export const updateAvatar = (data_url: string | null, version: number, signal?: AbortSignal) =>
  api.request<PersonalProfile>('v1/auth/profile/avatar', {
    method: 'POST',
    json: { data_url, version },
    signal,
  })
