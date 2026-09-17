import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileStyle, parse } from 'vue/compiler-sfc'
import { expect, it } from 'vitest'

function vueFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? vueFiles(path) : entry.name.endsWith('.vue') ? [path] : []
  })
}

it('component styles never compile into page-wide filters or opacity', () => {
  const violations: string[] = []
  let checked = 0
  for (const filename of vueFiles(fileURLToPath(new URL('../src', import.meta.url)))) {
    const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename })
    for (const style of descriptor.styles.filter((block) => block.scoped)) {
      const result = compileStyle({
        filename,
        source: style.content,
        id: 'data-v-theme-check',
        scoped: true,
      })
      expect(result.errors, filename).toEqual([])
      checked++
      result.rawResult?.root.walkRules((rule) => {
        // Check emitted CSS: Vue can discard descendants after :global(), even if
        // the source appears to target a component-local image.
        if (
          !rule.selectors.some((selector) =>
            /^(?:html|body|:root|#app)(?:\[[^\]]+\])*$/.test(selector.trim()),
          )
        )
          return
        rule.walkDecls((declaration) => {
          if (
            (declaration.prop === 'filter' && declaration.value !== 'none') ||
            (declaration.prop === 'opacity' && declaration.value !== '1')
          ) {
            violations.push(
              `${filename}: ${rule.selector} { ${declaration.prop}: ${declaration.value} }`,
            )
          }
        })
      })
    }
  }
  expect(checked).toBeGreaterThan(0)
  expect(violations).toEqual([])
})
