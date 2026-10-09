export const mcpDocHeadings = [
  { id: 'mcp-install', title: '让 Agent 帮你接入', level: 2 },
  { id: 'mcp-start', title: '接入准备', level: 2 },
  { id: 'mcp-tools', title: '七个核心工具', level: 2 },
  { id: 'mcp-knowledge', title: '事实与知识', level: 2 },
  { id: 'mcp-scenarios', title: '怎么向 Agent 提问', level: 2 },
  { id: 'mcp-audit', title: '覆盖范围与审计', level: 2 },
  { id: 'mcp-faq', title: '常见问题', level: 2 },
]

export const mcpRelease = {
  label: 'MCP 已实现 · 独立账号凭证',
  message:
    '自行创建多个独立 Token，设置有效区间或无限期，并单独撤销。服务地址按当前环境填写，访问范围跟随账号在本平台的项目权限。',
}
export const exampleProjectId = '5b0f6a52-1c2d-4c8e-9f35-2a1d7c9e4b10'
export const exampleArchiveId = '83edb100-2c15-4fd1-8d98-7ae034fa20ac'
export const exampleEndpointId = 'c7ba5708-8744-4d86-9eb4-4bd94e749b25'
export const exampleProjectName = '商用订单管理系统'
export const mcpTools = [
  {
    name: 'list_projects',
    label: '发现项目',
    description: '从这里开始：列出当前 MCP 凭证所属账号有权限访问的项目，不需要预先知道项目 ID。',
    parameters: [
      {
        name: 'offset / limit',
        type: 'integer',
        required: false,
        detail: '偏移量默认 0，数量默认 20、最多 50。',
      },
    ],
    returns: [
      {
        field: 'items[].project_id / name / status',
        detail: '已授权项目的 ID、名称和状态。不会暴露无权限项目。',
      },
      {
        field: 'total / has_more / next_offset',
        detail: '当前可访问项目总数与下一页位置。has_more 为 true 时，使用 next_offset 继续读取。',
      },
    ],
    tip: '先按项目名称匹配用户目标，遇到同名或多个匹配时请用户选择；不要让用户手动找 ID，也不要猜测 UUID。',
  },
  {
    name: 'list_project_environments',
    label: '选择环境',
    description: '列出所选授权项目的已配置环境，取得后续工具需要的 environment_id。',
    parameters: [
      {
        name: 'project_id',
        type: 'string',
        required: true,
        detail: 'list_projects 返回的项目 ID。',
      },
      {
        name: 'offset / limit',
        type: 'integer',
        required: false,
        detail: '偏移量默认 0，数量默认 20、最多 50。',
      },
    ],
    returns: [
      {
        field: 'items[].environment_id / name / project_id',
        detail: '环境 ID、名称及所属项目 ID，可直接传入后续接口工具。',
      },
      {
        field: 'total / has_more / next_offset',
        detail: '项目环境总数与明确的分页位置；空列表表示项目尚无已配置环境。',
      },
    ],
    tip: '以返回的环境名称确认测试、生产等目标。已配置环境不代表已有采集数据；不要混合不同环境的资料。',
  },
  {
    name: 'search_interfaces',
    label: '定位接口',
    description: '按名称、用途、方法和路径，在授权项目及环境中搜索已保存的接口。',
    parameters: [
      {
        name: 'project_id',
        type: 'string',
        required: true,
        detail: '目标项目，不能扩大 Token 权限。',
      },
      {
        name: 'query',
        type: 'string',
        required: false,
        detail: '关键词；留空可分页查看全部接口。',
      },
      { name: 'environment_id', type: 'string', required: false, detail: '限制观察环境。' },
      {
        name: 'method / business_scope',
        type: 'string',
        required: false,
        detail: '按 HTTP 方法和已观测路径片段筛选，例如 /client/；业务范围筛选不是权限授权。',
      },
      {
        name: 'offset / limit',
        type: 'integer',
        required: false,
        detail: '偏移量默认 0，数量默认 20、最多 50。',
      },
    ],
    returns: [
      {
        field: 'items / total / has_more',
        detail: '接口 ID、方法、路径、说明及明确的后续页标记。',
      },
    ],
    tip: 'has_more 为 true 时继续读取，不能用一页结果证明接口不存在。',
  },
  {
    name: 'read_interface',
    label: '读懂接口',
    description: '读取正式知识、结构事实、字段说明、关联和请求资料引用。',
    parameters: [
      { name: 'project_id', type: 'string', required: true, detail: '授权项目。' },
      { name: 'endpoint_id', type: 'string', required: true, detail: '搜索返回的接口 ID。' },
      {
        name: 'environment_id',
        type: 'string',
        required: false,
        detail:
          '限制请求资料引用的环境；字段和关系仍需核对各自来源，不假设整份详情都已按环境过滤。',
      },
      {
        name: 'field_offset / link_offset / offset',
        type: 'integer',
        required: false,
        detail: '分别分页字段、关联和请求资料引用。',
      },
      { name: 'limit', type: 'integer', required: false, detail: '每类默认 20 项，最多 50。' },
    ],
    returns: [
      {
        field: 'fields / links',
        detail:
          '字段位置包括请求和响应 Header；说明带来源及确认状态。fields_has_more 与 links_has_more 分别指示续页。',
      },
      {
        field: 'addresses / request_materials',
        detail:
          '环境地址、真实样本 ID、正文状态及完整性缺口；request_material_has_more 指示资料引用续页。',
      },
    ],
    tip: '从 request_materials 选择同一环境中的 example_id，再读取完整请求资料。',
  },
  {
    name: 'read_request_material',
    label: '构造请求',
    description: '读取已保存的 URL、query、Header、正文状态和根值、响应 Header 与来源。',
    parameters: [
      { name: 'project_id', type: 'string', required: true, detail: '授权项目。' },
      { name: 'endpoint_id', type: 'string', required: true, detail: '目标接口。' },
      {
        name: 'example_id',
        type: 'string',
        required: true,
        detail: 'read_interface 返回的保留样本 ID。',
      },
      {
        name: 'content_offset',
        type: 'integer',
        required: false,
        detail: '默认 0；按 next_offset 与 source_record 继续读取至 has_more=false。',
      },
      {
        name: 'source_record',
        type: 'object',
        required: false,
        detail:
          '返回非空来源时，续读原样传回 { batch_id, record_id }。SOURCE_CHANGED_RESTART_READ 表示来源变化，丢弃旧片段并从 0 重读；历史资料无来源 ID 时不能宣称已固定来源。',
      },
      {
        name: 'environment_id',
        type: 'string',
        required: false,
        detail: '防止请求资料来自另一环境；不匹配时返回 ENVIRONMENT_MISMATCH。',
      },
    ],
    returns: [
      {
        field: 'data / next_offset / has_more',
        detail: 'JSON 文本块。只拼接同一 source_record 的所有 data 后再解析，不能分别解析片段。',
      },
    ],
    tip: '原文按授权返回；历史凭据不代表当前有效。multipart 摘要没有文件字节，缺口需补充，工具不会执行业务 HTTP 请求。',
  },
  {
    name: 'trace_dependencies',
    label: '核对依赖',
    description: '根据已知输入与有来源的关系，列出仍缺的参数、来源、缺口或循环。',
    parameters: [
      {
        name: 'project_id / endpoint_id',
        type: 'string',
        required: true,
        detail: '项目及目标接口。',
      },
      {
        name: 'known_inputs',
        type: 'array',
        required: false,
        detail:
          '最多 100 项，每项为 { endpoint: UUID, location: { in: "path" | "query" | "request_header" | "request_body" }, path: 字段路径 }；这里描述已知字段，不上传字段值。',
      },
      {
        name: 'authenticated',
        type: 'boolean',
        required: false,
        detail: '调用者是否已有当前有效的业务认证，默认 false。',
      },
      {
        name: 'environment_id',
        type: 'string',
        required: false,
        detail: '多环境时必须明确，不能拼接跨环境调用链。',
      },
      {
        name: 'max_depth / max_steps',
        type: 'integer',
        required: false,
        detail:
          '深度默认 4、最多 8；步骤默认 60、最多 100。结果 truncated=true 时不能宣称依赖已经完整。',
      },
    ],
    returns: [
      {
        field: 'steps / gaps / cycles / truncated',
        detail: '可核查的上游引用、未解决事项和遍历边界。',
      },
    ],
    tip: '观测关系不是强制依赖；没有证据时不生成登录链。业务认证与 NexoFolio MCP Token 分开。',
  },
  {
    name: 'read_field_values',
    label: '读取完整观测值',
    description:
      '按字段读取全部已保存的不同值，保留类型、环境与来源；名称说明的模型预算不会截断这份值资料。',
    parameters: [
      {
        name: 'project_id / endpoint_id',
        type: 'string',
        required: true,
        detail: '授权项目及接口。',
      },
      {
        name: 'archive_id / field_key',
        type: 'string',
        required: true,
        detail: '来自字段 knowledge.context.observations.archive_id 与字段 key。',
      },
      {
        name: 'environment_id',
        type: 'string',
        required: false,
        detail: '筛选该环境的观测值；不同环境的值不能合并成一条已确认业务规则。',
      },
      {
        name: 'offset / limit',
        type: 'integer',
        required: false,
        detail: '分页读取值摘要，默认 20 条；has_more 为 true 时继续。',
      },
      {
        name: 'value_id / content_offset',
        type: 'string / integer',
        required: false,
        detail:
          '读取某个完整值时填写其 ID，按 next_offset 拼接 data 至 has_more=false，再解析 JSON。',
      },
    ],
    returns: [
      { field: 'summary / items / has_more', detail: '总数、原始类型、采集状态、来源及值摘要。' },
      {
        field: 'data / next_offset',
        detail: '指定 value_id 后返回原值 JSON 文本块；大整数与小数保持原精度。',
      },
    ],
    tip: 'null、空字符串、0、false、空对象和空数组分别保留。无正文、不可读取、截断属于采集状态，不会被编造成值；历史凭据不代表当前有效。',
  },
] as const
export function mcpToolArguments(
  index: number,
  all = false,
  context: { projectId?: string; environmentId?: string } = {},
) {
  const scope = {
    project_id: context.projectId || exampleProjectId,
    ...(context.environmentId ? { environment_id: context.environmentId } : {}),
  }
  const target = { ...scope, endpoint_id: exampleEndpointId }
  const name = mcpTools[index]?.name
  if (name === 'list_projects') return { offset: 0, limit: 20 }
  if (name === 'list_project_environments')
    return { project_id: scope.project_id, offset: 0, limit: 20 }
  if (name === 'search_interfaces')
    return { ...scope, query: all ? '' : '/orders', offset: 0, limit: 20 }
  if (name === 'read_interface')
    return { ...target, field_offset: 0, link_offset: 0, offset: 0, limit: 20 }
  if (name === 'read_request_material')
    return { ...target, example_id: 'example_id_from_read_interface', content_offset: 0 }
  if (name === 'read_field_values')
    return {
      ...target,
      archive_id: exampleArchiveId,
      field_key: 'field_key_from_read_interface',
      offset: 0,
      limit: 20,
    }
  return { ...target, authenticated: false, known_inputs: [] }
}

export function makeMcpConfig(value: string): { text: string; error: string } {
  let address = value.trim()
  if (!address) return { text: '', error: '请输入 MCP 服务地址，或使用当前环境的地址。' }
  try {
    const url = new URL(address)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return {
        text: '',
        error: '请填写 HTTP(S) 实例基础地址，不包含账号、密码、查询参数或 # 片段。',
      }
    address = url.href.replace(/\/+$/, '')
    if (/\/docs(?:\/|$)/.test(url.pathname))
      return { text: '', error: '这是文档地址，请填写部署方提供的 MCP 服务地址或服务基础地址。' }
  } catch {
    return { text: '', error: '请输入完整的 NexoFolio 实例地址。' }
  }
  return {
    text: JSON.stringify(
      {
        mcpServers: {
          nexofolio: {
            url: address.endsWith('/mcp') ? address : `${address}/mcp`,
            headers: { Authorization: 'Bearer YOUR_MCP_TOKEN' },
          },
        },
      },
      null,
      2,
    ),
    error: '',
  }
}

export const mcpScenarios = [
  {
    title: '理解陌生项目',
    route: '发现项目 → 搜索 → 详情',
    tools: 'list_projects / search_interfaces / read_interface',
    prompt: `请帮我了解「${exampleProjectName}」有哪些业务功能和主要接口。请完整阅读可访问的接口资料，并根据已有说明概括；尚未读到或无法确认的内容请明确告诉我。`,
  },
  {
    title: '准备真实 HTTP 请求',
    route: '发现项目与环境 → 搜索 → 请求资料',
    tools:
      'list_projects / list_project_environments / search_interfaces / read_interface / read_request_material',
    prompt: `请在「${exampleProjectName}」中找到“创建技术咨询单”接口，先与我确认环境，再准备一份包含地址、方法、Header、query 和请求体的请求草案。资料缺失或需要当前业务登录信息时请说明，先不要发送请求。`,
  },
  {
    title: '分析已知关联',
    route: '发现项目与环境 → 定位接口 → 依赖与来源',
    tools:
      'list_projects / list_project_environments / search_interfaces / read_interface / trace_dependencies',
    prompt: `请分析「${exampleProjectName}」中“创建技术咨询单”需要哪些前置信息、参数可以从哪里获得。请说明依据，区分已观察到、推断和待确认的关系；不要猜测登录流程。`,
  },
] as const
export const mcpFaqs = [
  {
    question: '怎样创建和撤销 MCP 凭证？',
    answer:
      '登录后从头像菜单或接口文档菜单进入 MCP 凭证页。填写名称，选择有效区间或无限期；创建后复制完整 Token，之后列表不会再次回显。每个 Token 可单独撤销，均访问账号当前有权限的所有项目，不需按项目分别创建。',
  },
  {
    question: '配置模板如何使用？',
    answer:
      '模板已按当前实例的 API 配置填写 MCP 地址，复制后只需在客户端本地替换 YOUR_MCP_TOKEN。不同客户端的配置格式可能不同，按其实际支持的字段配置。页面不会收集 Token、读取网页登录 Token 或自动连接。',
  },
  {
    question: 'Token 与项目 ID 分别用在哪里？',
    answer:
      'NexoFolio MCP Token 验证访问者身份及其有效项目权限。先调用 list_projects 取得项目 ID，再调用 list_project_environments 取得环境 ID；后续工具使用这些 ID。填写另一个项目 ID 不会扩大权限，MCP Token 也不能替代目标业务系统的登录凭据。',
  },
  {
    question: 'Header 或正文不完整怎么办？',
    answer:
      '以请求资料的状态和 gaps 为准。none 只说明该次调用未发送正文，full 的 {} 是完整空对象，partial 是摘要，unreadable 和 truncated 需要补充采集。页面拦截不能证明浏览器自动 Header 已完整捕获。',
  },
  {
    question: '大请求资料如何读取？',
    answer:
      '按 next_offset 继续调用 read_request_material，直到 has_more=false；依次拼接 data 再解析 JSON。Header 原始名称、值及重复项保留，历史认证的有效性仍未确认。',
  },
  {
    question: 'Agent 读到的说明都是真实观测吗？',
    answer:
      '事实来自采集；整理后的名称、用途、字段语义与关联保留来源及确认状态。LLM 解释不是新的独立事实，重要结论要回到样本、环境和时间核对。',
  },
  {
    question: 'MCP 会执行或修改业务接口吗？',
    answer: '这七个工具只读取授权项目、环境、知识和请求资料，不发起业务请求，不自动应用候选文档。',
  },
] as const

export const mcpSearchText =
  '\n\n' +
  mcpTools
    .map(
      (tool) =>
        `## ${tool.name}\n${tool.description}\n${tool.parameters.map((p) => `${p.name} ${p.type} ${p.required ? '必填' : '可选'} ${p.detail}`).join('\n')}\n${tool.returns.map((r) => `${r.field} ${r.detail}`).join('\n')}\n${tool.tip}`,
    )
    .join('\n\n') +
  '\n\n' +
  mcpFaqs.map((faq) => `${faq.question}\n${faq.answer}`).join('\n\n')
