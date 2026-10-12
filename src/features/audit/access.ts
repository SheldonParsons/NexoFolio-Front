import type { UserProfile } from '@/api/auth'
/** The capability must originate in login or /auth/me, never a stored profile. */
export function canViewAudit(user: UserProfile | null | undefined): boolean {
  return (
    user?.enabled === true &&
    user.account.toLowerCase() === 'a80646' &&
    user.can_manage_projects === true
  )
}
