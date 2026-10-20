import { afterEach, expect, it } from 'vitest'
import { reportRouteLoadFailure, routeLoadFailure } from '../src/app/routeLoadFailure'

afterEach(() => {
  routeLoadFailure.value = null
})

it.each([
  'Failed to fetch dynamically imported module: https://fixture/assets/Users-old.js',
  'Importing a module script failed.',
  'error loading dynamically imported module: https://fixture/assets/Audit-old.js',
  'Unable to preload CSS for /assets/Audit-old.css',
])('offers an explicit recovery destination for %s', (message) => {
  const href = '/nexofolio/management/audit?tab=curation#records'
  reportRouteLoadFailure(new TypeError(message), href)
  expect(routeLoadFailure.value?.href).toBe(href)
})

it.each([new Error('Forbidden'), new Error('Failed to fetch'), null, 'script failed'])(
  'does not treat unrelated errors as a stale resource: %s',
  (error) => {
    reportRouteLoadFailure(error, '/management/users')
    expect(routeLoadFailure.value).toBeNull()
  },
)
