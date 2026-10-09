import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { usePersonalProfile } from '@/features/profile/usePersonalProfile'
import * as source from '@/features/profile/source'
import { ApiError } from '@/api'
const value = (id = 'a', version = 0): source.PersonalProfile => ({
  user: { id, account: id, display_name: '账号姓名', enabled: true },
  account_display_name: '账号姓名',
  display_name_override: null,
  bio: '',
  version,
  created_at: '',
  last_login_at: '',
})
beforeEach(() => {
  setActivePinia(createPinia())
})
afterEach(() => vi.restoreAllMocks())
function fixture() {
  const auth = useAuthStore()
  auth.user = value().user
  return { auth, profile: usePersonalProfile() }
}
it('does not let an old identity reply replace a new user or clear its pending read', async () => {
  let old!: (v: source.PersonalProfile) => void, fresh!: (v: source.PersonalProfile) => void
  const read = vi
    .spyOn(source, 'readProfile')
    .mockImplementationOnce(() => new Promise((resolve) => (old = resolve)))
    .mockImplementationOnce(() => new Promise((resolve) => (fresh = resolve)))
  const { auth, profile } = fixture()
  const first = profile.load()
  auth.user = value('b').user
  await nextTick()
  old(value('a'))
  await first
  expect(profile.profile).toBeNull()
  expect(profile.loading).toBe(true)
  const joined = profile.load()
  expect(read).toHaveBeenCalledTimes(2)
  fresh(value('b'))
  await joined
  expect(profile.profile?.user.id).toBe('b')
})
it('reconciles an uncertain save without replaying and updates shared presentation only on success', async () => {
  const read = vi.spyOn(source, 'readProfile').mockResolvedValue(value())
  const update = vi
    .spyOn(source, 'updateProfile')
    .mockRejectedValue(new ApiError('timeout', 'timeout'))
  const { auth, profile } = fixture()
  await profile.load()
  const saved = {
    ...value('a', 1),
    user: { ...value().user, display_name: '新的展示' },
    display_name_override: '新的展示',
    bio: '介绍',
  }
  read.mockResolvedValue(saved)
  expect(await profile.saveText('新的展示', '介绍')).toBe(true)
  expect(update).toHaveBeenCalledTimes(1)
  expect(auth.displayName).toBe('新的展示')
  expect(profile.error).toBe('')
})
it('retains the old avatar and profile on save failure', async () => {
  const current = {
    ...value(),
    user: { ...value().user, avatar_url: 'data:image/webp;base64,old' },
  }
  vi.spyOn(source, 'readProfile').mockResolvedValue(current)
  vi.spyOn(source, 'updateAvatar').mockRejectedValue(new ApiError('保存失败', 'http', 503))
  const { auth, profile } = fixture()
  await profile.load()
  expect(await profile.saveAvatar('data:image/webp;base64,new')).toBe(false)
  expect(auth.user?.avatar_url).toBe(current.user.avatar_url)
  expect(profile.profile?.version).toBe(0)
  expect(profile.error).toBe('保存失败')
})
