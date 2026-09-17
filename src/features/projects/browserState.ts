import type { ProjectAccess, ProjectPage } from './types'
export interface BrowserSnapshot {
  query: string
  access: ProjectAccess | 'all'
  page: number
  scrollTop: number
  result: ProjectPage | null
}
const views = new Map<string, BrowserSnapshot>()
let generation = 0
export const browserViewGeneration = () => generation
export const readBrowserView = (scope: string): BrowserSnapshot =>
  views.get(scope) ?? { query: '', access: 'all', page: 1, scrollTop: 0, result: null }
export function saveBrowserView(scope: string, value: BrowserSnapshot, owner = generation) {
  if (owner === generation) views.set(scope, value)
}
export function clearBrowserViews() {
  generation++
  views.clear()
}
