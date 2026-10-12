import { mcpPurpose } from './content'

export const mcpConversation = [
  {
    user: '帮我查商用订单管理系统测试环境中，管理端完成技术咨询任务需要的 taskId 从哪里来，先不要发送请求。',
    agent:
      '按名称发现项目和环境。可以沿“技术咨询”目录浏览，也可以搜索接口或字段；定位到目标请求体的 taskId 后读取完整语义。范围或目标不唯一时请用户选择，不要求用户查 ID。',
    tools:
      'list_projects → list_project_environments → browse_directory 或 search_interfaces；由 Agent 自己选路并记录未读范围。',
  },
  {
    user: '核对这个字段提到的来源接口，看看已有样本能证明到哪一步。',
    agent:
      '跟随已保存关联和 source_reads，按需读取对应的来源响应、目标请求及上下文。分别核对字段值、环境、页面、view_id 和来源完成/目标开始时间；同时检查来源所需输入。样本同值与时间先后不能证明必须先调用，也不能确认多待办任务时的选值规则。',
    tools:
      'read_source_evidence → 精确请求/响应/context 入口；引用缺失或需要比较时再用 samples。长资料沿 next 原样续读。',
  },
  {
    user: '再看看商机项目中的“执行主体来源”，如果字段说需要查字典，能找到对应接口吗？',
    agent:
      '搜索字段并直接读完整语义。没有结构化接口引用时，从说明中提取“字典”等关键词搜索。找到通用字典查询只说明可能相关；缺少具体字典编码、映射或样本时，保留候选，不能解释某个数字的含义。',
    tools: 'search_interfaces(search_in=fields) → matched_field.open → 文字线索搜索与核对。',
  },
  {
    user: '这些字段的说明已经生成，为什么还会显示待确认？还缺什么资料？',
    agent:
      '按本次问题选择覆盖汇总、相关字段或采集缺口明细。分别报告生成处理、名称/语义确认和采集完整度；candidate 不是生成失败，capture_inspected=false 也不是采集已经完整。观测值按需读取，不能当作封闭业务枚举。',
    tools:
      'inspect_knowledge_coverage(summary → groups[].open)；需要具体值时再用 read_field_values。',
  },
] as const

export const mcpCoverageCapabilities = [
  {
    title: '接口与请求资料核对',
    status: '已有',
    detail:
      '支持目录、字段和关系按需展开，以及请求、响应和来源完整续读；Agent 决定检索路径，覆盖检查不等于业务完整性保证。',
  },
  {
    title: '授权项目与环境发现',
    status: '已有',
    detail:
      'list_projects 无需项目 ID，列出账号当前可访问项目；list_project_environments 返回所选项目的环境。两者均分页，返回的 ID 可直接用于后续工具。',
  },
  {
    title: '已保存资料覆盖检查',
    status: '已有',
    detail:
      '汇总提供问题分组，明细支持按类别或精确字段读取，Agent 根据问题选择范围。分别报告生成处理、语义确认和采集缺口；没有已知问题不代表业务已经完整或正确。',
  },
  {
    title: '样本和上下文核对',
    status: '按已保存资料',
    detail:
      '可以分别读取请求、响应、页面/客户端/视图及时间上下文。未采集、未保留和未确认会保留边界；样本对应不能证明业务必调顺序。',
  },
] as const

export const mcpInstallSteps = [
  '阅读整体使用说明，理解目录、搜索、字段、关联和原始资料怎样逐层展开，以及来源、确认状态和缺口能支持什么判断。检索入口、路线、深度与停止时机由 Agent 根据业务目标自主决定。',
  '使用本文的当前实例连接信息：服务地址按当前域名和已配置的 API 前缀生成，文档链接与 MCP 协议地址分别提供，无需猜测实例地址。',
  '确认目标客户端支持 Streamable HTTP 和自定义 Authorization Header。沿用该客户端实际配置格式；不要安装不存在的 npm 包或假设所有客户端通用同一份 JSON。',
  '由用户在 MCP 凭证页面创建自己的专用凭证，填写名称，选择有效时间区间或无限期。可创建多个并独立撤销，完整 token 仅创建时显示一次；不能把网页登录 token 当成 MCP 凭证。',
  '只添加或更新 nexofolio 这一项，保留其他 MCP 配置；使用客户端支持的本地凭据存储方式，不在对话中回显真实凭证。',
  '完成 initialize 和 tools/list，读取整体 instructions，核对当前 11 个工具及 field_summary、coverage summary/issues 定义。范围尚未确定时可用项目和环境发现取得真实 ID；已有明确范围可继续使用。同名且影响判断时请用户选择，再用用户选定的业务问题做一次只读检索。保存配置或看到已连接不等于场景验证通过。',
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
  ]
    .filter(Boolean)
    .join('\n')
  return [
    `帮我安装这个 MCP：${documentUrl}。`,
    details,
    '请先阅读文档，理解 NexoFolio 的资料结构及其用途，再为支持 Streamable HTTP 和 Authorization Header 的客户端配置连接。',
    mcpPurpose.spirit.replace('你的业务目标', '我的业务目标') +
      mcpPurpose.benefit +
      mcpPurpose.evidence,
    '如何检索由你自主决定。请利用这些入口缩小相关范围、跟随线索、按需取得完整资料；需要更多依据时，自主扩大范围或继续展开。支撑结论的关键资料要读完整，回答时说明依据，区分实际观测、候选解释和未知点，并交代影响结论的资料缺口。',
    '保留我已有的其他 MCP 配置。Token 由我创建并在客户端本地填写，不使用网页登录 Token，也不在对话中回显真实凭证。凭证未提供时明确告诉我。',
    '接入后读取服务的整体 instructions 和实际工具定义，再用我选定的业务问题做一次只读检索验证。项目或环境尚未明确时按名称发现，同名且影响判断时让我选择，不猜测 ID。不发送业务请求、不启动整理或修改资料。',
  ]
    .filter(Boolean)
    .join('\n\n')
}

export const mcpOnboardingText = [
  '## Agent 接入执行顺序\n' + mcpInstallSteps.map((step, i) => `${i + 1}. ${step}`).join('\n'),
  '## 具体对话模拟\n这是一条验收场景，不是已经执行的业务调用；项目、环境、接口和样本 ID 都需从实际资料取得。\n' +
    mcpConversation
      .map((turn) => `用户：${turn.user}\nAgent 应执行：${turn.agent}\n工具与边界：${turn.tools}`)
      .join('\n\n'),
  '## 资料覆盖与边界\n' +
    mcpCoverageCapabilities
      .map((item) => `### ${item.title}（${item.status}）\n${item.detail}`)
      .join('\n\n'),
].join('\n\n')
