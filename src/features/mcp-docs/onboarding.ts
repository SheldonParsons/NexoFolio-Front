export const mcpConversation = [
  {
    user: '帮我准备商用订单管理系统中“创建技术咨询单”的 HTTP 请求，使用测试环境，先不要发送。',
    agent:
      '先列出我有权限的项目，按名称定位商用订单管理系统；再列出该项目的环境，确认测试环境及客户端/管理端范围。遇到多个匹配时请用户选择，不要求用户查找 ID。',
    tools: 'list_projects → list_project_environments → search_interfaces；分页未结束时继续读取。',
  },
  {
    user: '就用你查到的项目和测试环境。选择客户端接口，业务登录已经准备好，请把 Header、query 和请求体都列出来。',
    agent:
      '用搜索返回的 endpoint_id 读取详情，分别读完字段、关系和请求资料引用。选择同一环境的样本，读完所有原文片段。区分未发送正文、完整空对象和不完整采集，历史认证不能替代当前登录。',
    tools:
      'read_interface → read_request_material；三个详情分页标记分别处理，原文续读携带 source_record。',
  },
  {
    user: '我已有当前登录和部门 ID，其他参数需要从哪些接口获得？',
    agent:
      '把已知字段的位置和路径交给依赖工具，逐项说明有证据的来源、缺口和循环。authenticated 只是调用者声明，工具不会验证业务登录，也不会替用户执行上游请求。',
    tools: 'trace_dependencies；known_inputs 每项包含 endpoint、location: { in: ... }、path。',
  },
  {
    user: '状态字段有哪些值？你能保证所有字段都已经解释完整了吗？',
    agent:
      '沿字段的 observations.archive_id 与 key 读取各类型观测值，必要时分块读取原值。观测值不是封闭业务枚举。当前没有项目知识完整性审计工具，只能汇总已读资料和明确缺口，不能保证不存在未采集、未解释的内容。',
    tools: 'read_field_values；需要全项目质量结论时，审计能力仍待补齐。',
  },
] as const

export const mcpAuditCapabilities = [
  {
    title: '接口与请求资料核对',
    status: '已有',
    detail:
      '五个知识工具支持分页、来源引用、采集缺口与依赖边界，另外两个工具提供项目与环境发现。适合逐个接口核对，不能替代完整性审计。',
  },
  {
    title: '授权项目与环境发现',
    status: '已有',
    detail:
      'list_projects 无需项目 ID，列出账号当前可访问项目；list_project_environments 返回所选项目的环境。两者均分页，返回的 ID 可直接用于后续工具。',
  },
  {
    title: '项目知识完整性审计',
    status: '待补齐',
    detail:
      '需要统计未解释字段、待确认语义、请求资料缺口、证据失效与关系冲突，并提供可分页的具体问题。没有问题记录不等于知识完整。',
  },
  {
    title: 'MCP 工具调用审计',
    status: '待补齐',
    detail:
      '已有 HTTP 请求 ID 和基础日志；尚无可查询的工具调用记录，不能在平台按用户、凭证、项目、工具、结果和耗时回看完整使用过程。',
  },
] as const

export const mcpInstallSteps = [
  '使用本文的当前实例连接信息：服务地址按当前域名和已配置的 API 前缀生成，文档链接与 MCP 协议地址分别提供，无需猜测实例地址。',
  '确认目标客户端支持 Streamable HTTP 和自定义 Authorization Header。沿用该客户端实际配置格式；不要安装不存在的 npm 包或假设所有客户端通用同一份 JSON。',
  '由用户在 MCP 凭证页面创建自己的专用凭证，填写名称，选择有效时间区间或无限期。可创建多个并独立撤销，完整 token 仅创建时显示一次；不能把网页登录 token 当成 MCP 凭证。',
  '只添加或更新 nexofolio 这一项，保留其他 MCP 配置；使用客户端支持的本地凭据存储方式，不在对话中回显真实凭证。',
  '完成 initialize 和 tools/list，核对七个工具。调用 list_projects、list_project_environments 取得真实项目和环境 ID，再做一次 search_interfaces 的只读查询；名称不唯一时请用户选择。仅保存配置、勾选核对清单或看到已连接，都不等于接入验证通过。',
  '报告实际服务地址、发现的工具、验证的项目和读取结果；授权或网络未完成时，明确当前卡在哪一步。不要自动开始整理、应用候选文档或执行业务 HTTP 请求。',
] as const

export function mcpInstallPrompt(
  documentUrl: string,
  context: {
    serviceUrl?: string
    credentialsUrl?: string
    projectId?: string
    environmentId?: string
  } = {},
) {
  const details = [
    context.serviceUrl ? `MCP 服务地址：${context.serviceUrl}。` : '',
    context.credentialsUrl ? `专用 Token 在这里创建：${context.credentialsUrl}。` : '',
    context.projectId ? `只读验收项目 ID：${context.projectId}。` : '',
    context.environmentId ? `验收环境 ID：${context.environmentId}。` : '',
  ].join('')
  return `帮我安装这个 MCP：${documentUrl}。${details}请按本文为支持 Streamable HTTP 和 Authorization Header 的客户端配置连接，保留我的其他 MCP 配置。Token 由我创建并在客户端本地填写，不要使用网页登录 Token。安装后列出实际工具，通过 list_projects 和 list_project_environments 发现我有权限的项目与环境，再对我选定的目标做一次只读查询。名称不唯一时让我选择；凭证未提供时明确告诉我，不要猜测 ID。`
}

export const mcpOnboardingText = [
  '## Agent 接入执行顺序\n' + mcpInstallSteps.map((step, i) => `${i + 1}. ${step}`).join('\n'),
  '## 具体对话模拟\n这是一条验收场景，不是已经执行的业务调用；项目、环境、接口和样本 ID 都需从实际资料取得。\n' +
    mcpConversation
      .map((turn) => `用户：${turn.user}\nAgent 应执行：${turn.agent}\n工具与边界：${turn.tools}`)
      .join('\n\n'),
  '## 当前覆盖与审计缺口\n' +
    mcpAuditCapabilities
      .map((item) => `### ${item.title}（${item.status}）\n${item.detail}`)
      .join('\n\n'),
].join('\n\n')
