import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const root = fileURLToPath(new URL('../src/features/documents/', import.meta.url))
it('keeps the document facade free of request and polling implementation', () => {
  const source = readFileSync(root + 'useDocumentWorkspace.ts', 'utf8')
  for (const forbidden of [
    'api.request',
    'AbortController',
    'setTimeout',
    'startCurate(',
    'curateProgress(',
    'knowledge.endpoint(',
  ]) {
    expect(source, forbidden).not.toContain(forbidden)
  }
})
it('keeps field evidence presentation free of API and business inference', () => {
  const source = readFileSync(root + 'FieldEvidencePanel.vue', 'utf8')
  for (const forbidden of [
    "from '@/api",
    "from '@/contracts/knowledge/source",
    'AbortController',
    'fetch(',
  ]) {
    expect(source, forbidden).not.toContain(forbidden)
  }
})
it('requires a responsibility review before a document source exceeds 400 lines', () => {
  for (const file of readdirSync(root).filter((file) => /\.(ts|vue)$/.test(file))) {
    const source = readFileSync(root + file, 'utf8')
    expect(source.trimEnd().split('\n').length, file).toBeLessThanOrEqual(400)
  }
})
