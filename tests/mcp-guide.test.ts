import { describe, expect, it } from 'vitest'
import {
  exampleEndpointId,
  exampleProjectId,
  makeMcpConfig,
  mcpToolArguments,
  mcpTools,
} from '../src/features/mcp-docs/content'
import { mcpDocumentationLinks } from '../src/features/mcp-docs/environment'
import { mcpInstallPrompt } from '../src/features/mcp-docs/onboarding'

describe('MCP documentation examples', () => {
  it('starts the progressive retrieval workflow with project and environment discovery', () => {
    expect(mcpTools.map((tool) => tool.name)).toEqual([
      'list_projects',
      'list_project_environments',
      'search_interfaces',
      'read_interface',
      'read_request_material',
      'trace_dependencies',
      'read_field_values',
      'browse_directory',
      'read_response_material',
      'read_source_evidence',
      'inspect_knowledge_coverage',
    ])
  })
  it('keeps project scope and continuation parameters in request material examples', () => {
    expect(mcpToolArguments(0)).toEqual({ offset: 0, limit: 20 })
    expect(mcpToolArguments(1)).toEqual({ project_id: exampleProjectId, offset: 0, limit: 20 })
    expect(mcpToolArguments(2, true)).toMatchObject({
      project_id: exampleProjectId,
      query: '',
      offset: 0,
    })
    expect(mcpToolArguments(3)).toMatchObject({
      project_id: exampleProjectId,
      endpoint_id: exampleEndpointId,
    })
    expect(mcpToolArguments(4)).toMatchObject({
      project_id: exampleProjectId,
      endpoint_id: exampleEndpointId,
      content_offset: 0,
    })
    expect(mcpToolArguments(5)).toMatchObject({ authenticated: false })
  })

  it('uses grouped coverage and exposes complete meaning/source expansion', () => {
    const index = mcpTools.findIndex((tool) => tool.name === 'inspect_knowledge_coverage')
    expect(mcpToolArguments(index)).toMatchObject({ section: 'summary' })
    expect(
      mcpTools
        .find((tool) => tool.name === 'read_interface')
        ?.parameters.find((p) => p.name === 'section')?.detail,
    ).toContain('field_summary')
    expect(
      mcpTools
        .find((tool) => tool.name === 'read_source_evidence')
        ?.returns.map((r) => r.detail)
        .join(' '),
    ).toContain('source_reads')
  })
  it('generates valid client JSON with a placeholder instead of collecting a secret', () => {
    const result = makeMcpConfig(' https://example.com:8443/nexofolio/ ')
    expect(result.error).toBe('')
    expect(JSON.parse(result.text).mcpServers.nexofolio).toEqual({
      url: 'https://example.com:8443/nexofolio/mcp',
      headers: { Authorization: 'Bearer YOUR_MCP_TOKEN' },
    })
    expect(makeMcpConfig('').text).toBe('')
    expect(makeMcpConfig('').error).toContain('当前环境')
  })
  it.each([
    ['http://127.0.0.1:5173/docs/mcp', 'http://127.0.0.1:5173'],
    ['https://nexofolio.net/docs/mcp', 'https://nexofolio.net'],
  ])('fills the service, credential and document links for %s', (page, origin) => {
    const links = mcpDocumentationLinks('/api', page)
    expect(links).toEqual({
      serviceUrl: origin + '/api/mcp',
      documentUrl: origin + '/docs/mcp',
      credentialsUrl: origin + '/settings/mcp',
      referenceUrl: origin + '/mcp.md',
    })
    const config = JSON.parse(makeMcpConfig(links.serviceUrl).text)
    expect(config.mcpServers.nexofolio.url).toBe(origin + '/api/mcp')
    const prompt = mcpInstallPrompt(links.documentUrl, links)
    expect(prompt).toContain(links.serviceUrl)
    expect(prompt).toContain(links.documentUrl)
    expect(prompt).toContain(links.credentialsUrl)
    if (origin.startsWith('https:')) expect(prompt).not.toContain('127.0.0.1')
  })
  it('keeps an independently hosted API separate from the document application path', () => {
    const links = mcpDocumentationLinks(
      'https://api.example.com/gateway/',
      'https://example.com/nexofolio/docs/mcp',
      '/nexofolio/',
    )
    expect(links.serviceUrl).toBe('https://api.example.com/gateway/mcp')
    expect(links.documentUrl).toBe('https://example.com/nexofolio/docs/mcp')
    expect(links.credentialsUrl).toBe('https://example.com/nexofolio/settings/mcp')
  })
  it('fills known project and environment scope without inventing endpoint references', () => {
    const context = {
      projectId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      environmentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    }
    expect(mcpToolArguments(0, false, context)).toEqual({ offset: 0, limit: 20 })
    expect(mcpToolArguments(1, false, context)).toEqual({
      project_id: context.projectId,
      offset: 0,
      limit: 20,
    })
    for (let index = 2; index < mcpTools.length; index++)
      expect(mcpToolArguments(index, false, context)).toMatchObject({
        project_id: context.projectId,
        environment_id: context.environmentId,
      })
    expect(mcpInstallPrompt('https://example.com/docs/mcp', context)).toContain(context.projectId)
    expect(mcpInstallPrompt('https://example.com/docs/mcp', context)).toContain(
      context.environmentId,
    )
  })
  it('accepts a complete protocol URL without duplicating /mcp and rejects document URLs', () => {
    expect(
      JSON.parse(makeMcpConfig('https://example.com/api/mcp/').text).mcpServers.nexofolio.url,
    ).toBe('https://example.com/api/mcp')
    expect(makeMcpConfig('http://127.0.0.1:5173/docs/mcp').text).toBe('')
    expect(makeMcpConfig('http://127.0.0.1:5173/docs/mcp').error).toContain('文档地址')
  })

  it.each([
    'not-a-url',
    'javascript:alert(1)',
    'https://user:password@example.com',
    'https://example.com?token=example',
    'https://example.com#secret',
  ])('rejects invalid or credential-bearing instance input: %s', (address) => {
    expect(makeMcpConfig(address).text).toBe('')
    expect(makeMcpConfig(address).error).not.toBe('')
  })
})
