import { shallowRef } from 'vue'

export const routeLoadFailure = shallowRef<{ href: string } | null>(null)

export function reportRouteLoadFailure(error: unknown, href: string) {
  if (
    error instanceof Error &&
    /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(
      error.message,
    )
  )
    routeLoadFailure.value = { href }
}
