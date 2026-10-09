import { expect, it } from 'vitest'
import { exampleProjectName, mcpScenarios } from '@/features/mcp-docs/content'
it('lets users ask business questions by project name without providing identifiers', () => {
  for (const scenario of mcpScenarios) {
    expect(scenario.prompt).toContain(exampleProjectName)
    expect(scenario.prompt).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    )
    expect(scenario.prompt).not.toMatch(/project_id|endpoint_id|has_more/)
    expect(scenario.tools).toContain('list_projects')
  }
})
