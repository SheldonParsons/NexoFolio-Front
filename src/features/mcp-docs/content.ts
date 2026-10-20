export const mcpDocHeadings = [
  { id: 'mcp-install', title: '让 Agent 帮你接入', level: 2 },
  { id: 'mcp-start', title: '接入准备', level: 2 },
  { id: 'mcp-retrieval', title: '把检索交给 Agent', level: 2 },
  { id: 'mcp-tools', title: '只读检索工具', level: 2 },
  { id: 'mcp-knowledge', title: '事实与知识', level: 2 },
  { id: 'mcp-scenarios', title: '怎么向 Agent 提问', level: 2 },
  { id: 'mcp-audit', title: '资料覆盖与边界', level: 2 },
  { id: 'mcp-faq', title: '常见问题', level: 2 },
]

export const mcpRelease = {
  label: '11 个只读工具 · 按需展开知识',
  message:
    'Agent 自己选择目录、搜索或字段线索，逐步读取完整语义、关联与原始依据。创建独立 MCP Token 后即可接入，服务地址按当前环境填写。',
}
export const mcpPurpose = {
  spirit:
    'NexoFolio 提供可以逐层展开、核对来源的接口知识。检索入口、路线、深度和停止时机，由 Agent 根据你的业务目标自主决定。',
  benefit:
    '目录、搜索、字段和关联帮助缩小相关范围，每次取得当前需要的内容，减少无关资料占用上下文和重复读取。需要全貌或更多依据时，也可以扩大范围或完整读取。',
  evidence:
    '完整说明、关联依据和原始样本都有继续读取的入口；来源、环境、时间、确认状态和资料缺口帮助判断结论能支持到哪一步。',
} as const
export const mcpRetrievalPaths = [
  {
    title: '先了解陌生项目',
    route: '项目与环境 → 业务目录 → 相关接口',
    detail: '先看目录介绍和直接子目录，选择相关分支。目录为空时仍可查未分类或全部接口。',
  },
  {
    title: '直接找已知接口或字段',
    route: '名称、路径或字段含义 → 搜索 → 所需资料',
    detail: '接口命中按需看概览；精确字段命中直接读完整语义，不必先重复读取接口概览。',
  },
  {
    title: '顺着字段查来源',
    route: '完整字段说明 → 已存引用或文字搜索 → 核对依据',
    detail: '有明确引用就跟随；只有“需查字典”等文字时提取线索再搜索，找到候选后继续核实。',
  },
] as const
export const mcpReadingRules = [
  '入口可以交替使用，没有固定的工具调用顺序。Agent 根据目标自主缩小或扩大范围，取得足够依据后说明结论和影响判断的未读范围。',
  '字段树的 open 读取完整语义，expand 只在有子字段时出现。field_summary 保留完整说明和未知点，证据、原值和完整快照另行展开。',
  '已保存引用提供直接读取工具和参数，可以减少重复定位。样本索引用于选择、比较或补查；替代样本不能当作原证据。',
  '覆盖汇总帮助了解问题分布，明细可以限定问题组或字段；按任务选择范围，分别判断生成完成、语义确认和采集完整度。',
] as const
export const exampleProjectId = '5b0f6a52-1c2d-4c8e-9f35-2a1d7c9e4b10'
export const exampleArchiveId = '83edb100-2c15-4fd1-8d98-7ae034fa20ac'
export const exampleEndpointId = 'c7ba5708-8744-4d86-9eb4-4bd94e749b25'
export const exampleProjectName = '商用订单管理系统'
export const mcpTools = [
  {
    name: 'list_projects',
    label: '发现项目',
    description: '按名称找到当前账号可访问的项目，无需用户提供 UUID。',
    parameters: [
      {
        name: 'offset / limit',
        type: 'integer',
        required: false,
        detail: '默认 0/20，最多 50；has_more=true 时使用 next_offset。',
      },
    ],
    returns: [
      {
        field: 'items / total / next_offset',
        detail: '项目 ID、名称、状态及分页。',
      },
    ],
    tip: '名称不唯一时请用户选择；不要猜测 ID。',
  },
  {
    name: 'list_project_environments',
    label: '选择环境',
    description: '读取项目已配置环境，确认测试、生产等名称。',
    parameters: [
      {
        name: 'project_id',
        type: 'string',
        required: true,
        detail: '发现工具返回的授权项目 ID。',
      },
      {
        name: 'offset / limit',
        type: 'integer',
        required: false,
        detail: '默认 0/20，最多 50。',
      },
    ],
    returns: [
      {
        field: 'items / total / next_offset',
        detail: '环境 ID、名称、所属项目及分页。',
      },
    ],
    tip: '已配置环境不代表已有采集资料。',
  },
  {
    name: 'search_interfaces',
    label: '搜索接口或字段',
    description:
      '按已保存名称、用途、方法、路径，或字段名称/说明找所属接口。通用字面匹配，由 Agent 提取搜索词。',
    parameters: [
      {
        name: 'project_id',
        type: 'string',
        required: true,
        detail: '发现工具返回的授权项目 ID。',
      },
      {
        name: 'environment_id',
        type: 'string',
        required: false,
        detail: '明确所选环境；目录计数和样本按此范围读取。',
      },
      {
        name: 'query / search_in',
        type: 'string',
        required: false,
        detail: 'query 可留空；search_in=interface（默认）或 fields。字段模式可选 view=grouped，同页共享接口/目录；每字段保留完整入口，offset/total 按字段计数。精确 key/名称优先，同级稳定；多个词需同时匹配。',
      },
      {
        name: 'directory_id',
        type: 'string',
        required: false,
        detail: '可限定目录，默认只查直接成员。',
      },
      {
        name: 'recursive',
        type: 'boolean',
        required: false,
        detail: '默认 false；指定目录时用 true 明确包含子目录。',
      },
      {
        name: 'method / business_scope',
        type: 'string',
        required: false,
        detail: 'HTTP 方法和路径片段筛选；不代表权限或强制业务流程。',
      },
      {
        name: 'offset / limit',
        type: 'integer',
        required: false,
        detail: '默认 0/20，每页最多 50。按 next 中的工具和参数续读。',
      },
      {
        name: 'revision',
        type: 'string',
        required: false,
        detail: '续读时传回返回的版本；变化后从头重读本次查询。',
      },
    ],
    returns: [
      {
        field: 'items[].open',
        detail: '接口搜索模式保留轻量接口摘要和概览下一跳。',
      },
      {
        field: 'matched_field / matched_field.open',
        detail:
          '字段模式保留所属接口、字段名称、说明预览及精确 key；open 直接读取完整语义，不必先读接口概览。位置未知的旧资料先展开字段事实，不猜请求/响应位置。逐环境流量可按 endpoint_id 另读 overview。',
      },
    ],
    tip: '字段搜索范围是已保存的字段知识；未整理字段仍可沿接口的 fields 读取。',
  },
  {
    name: 'read_interface',
    label: '分块读接口',
    description:
      '各 section 均可直接读取；description_summary 保留完整说明、用途和未知点，合并重复认证观测并延后来源坐标；description 保留旧全文。field_summary 提供完整字段语义和少量引用。',
    parameters: [
      {
        name: 'project_id',
        type: 'string',
        required: true,
        detail: '发现工具返回的授权项目 ID。',
      },
      {
        name: 'environment_id',
        type: 'string',
        required: false,
        detail: '明确所选环境；目录计数和样本按此范围读取。',
      },
      {
        name: 'endpoint_id',
        type: 'string',
        required: true,
        detail: '上一步返回的接口 ID。',
      },
      {
        name: 'section',
        type: 'string',
        required: true,
        detail:
          'overview / description_summary / description / fields / field_summary / field / relations / samples。field_summary 保留完整语义，field 保留完整资料快照；省略保留旧版组合读取。',
      },
      {
        name: 'field_key / parent_key',
        type: 'string',
        required: false,
        detail:
          'field_summary / field 必须传准确 field_key；fields 可传 parent_key 展开直接子字段。',
      },
      {
        name: 'location',
        type: 'object',
        required: false,
        detail:
          'fields 可指定 { in: path/query/request_header/request_body/response_header/response_body }；响应位置同时包含 status，如 { in: "response_body", status: 200 }。',
      },
      {
        name: 'direction',
        type: 'string',
        required: false,
        detail: 'relations 支持 incoming / outgoing / both，并可按 field_key 找关联；evidence_assessment 区分记录对应、来源候选和未证明项，旧关系未重验仍标未知。',
      },
      {
        name: 'offset / limit',
        type: 'integer',
        required: false,
        detail: '默认 0/20，每页最多 50。按 next 中的工具和参数续读。',
      },
      {
        name: 'revision',
        type: 'string',
        required: false,
        detail: '续读时传回返回的版本；变化后从头重读本次查询。',
      },
      {
        name: 'content_offset / max_chars',
        type: 'integer',
        required: false,
        detail: '偏移默认 0；每块默认最多 16384 个字符，可减至 256。拼完所有 data 再解析 JSON。',
      },
      {
        name: 'field_offset / link_offset',
        type: 'integer',
        required: false,
        detail: '仅旧版组合读取使用，分别续读字段和关系；新读取使用对应 section 返回的 next。',
      },
    ],
    returns: [
      {
        field: 'interface / expand',
        detail:
          '轻量概览、目录路径和展开入口；未读取的结构/样本数量为 null，已保存字段说明数另行提供。',
      },
      {
        field: 'items / next',
        detail:
          '字段树以 key 表达精确位置与路径，open 读取完整语义；只有 children>0 的节点提供 expand。完整结构路径仍在 field_summary / field 中。关联或样本索引独立分页。',
      },
      {
        field: 'data / next',
        detail:
          'description_summary / description / field_summary / field 返回可完整续读的 JSON 文本块；语义视图不截断说明，证据与值另行展开。',
      },
    ],
    tip: '文字提及是搜索线索；已保存的关联和字段证据提供直接接口引用，不能把观测对应当成强制前置。',
  },
  {
    name: 'read_request_material',
    label: '读取请求原文',
    description: '读取选定样本的原始 URL、Header、正文和采集状态；支持只读需要的部分。',
    parameters: [
      {
        name: 'project_id',
        type: 'string',
        required: true,
        detail: '发现工具返回的授权项目 ID。',
      },
      {
        name: 'environment_id',
        type: 'string',
        required: false,
        detail: '明确所选环境；目录计数和样本按此范围读取。',
      },
      {
        name: 'endpoint_id',
        type: 'string',
        required: true,
        detail: '上一步返回的接口 ID。',
      },
      {
        name: 'example_id',
        type: 'string',
        required: true,
        detail: 'samples 返回的已保留样本 ID。',
      },
      {
        name: 'part',
        type: 'string',
        required: false,
        detail: 'all（默认）/ headers / url / body / parsed_body。parsed_body 只返回完整解析根和采集状态，提供同记录原文入口；旧 all/body 保留。',
      },
      {
        name: 'content_offset / max_chars',
        type: 'integer',
        required: false,
        detail: '偏移默认 0；每块默认最多 16384 个字符，可减至 256。拼完所有 data 再解析 JSON。',
      },
      {
        name: 'revision',
        type: 'string',
        required: false,
        detail: '原样使用 next.arguments；来源变化时丢弃旧片段重新读取。',
      },
      {
        name: 'source_record',
        type: 'object',
        required: false,
        detail: '返回的 { batch_id, record_id } 来源标识；样本续读原样传回，不自行构造。',
      },
    ],
    returns: [
      {
        field: 'data / next',
        detail: '原始 JSON 文本块、来源及续读参数。',
      },
    ],
    tip: 'Header 保留重复项；none、{}、partial、truncated 与 unreadable 分别保留。历史认证不代表当前有效。',
  },
  {
    name: 'trace_dependencies',
    label: '按需追踪来源',
    description:
      'Agent 明确要求时，对已保存输入来源关系做有界追踪。基础关系也可通过 read_interface 自主逐步读取。',
    parameters: [
      {
        name: 'project_id',
        type: 'string',
        required: true,
        detail: '发现工具返回的授权项目 ID。',
      },
      {
        name: 'environment_id',
        type: 'string',
        required: false,
        detail: '明确所选环境；目录计数和样本按此范围读取。',
      },
      {
        name: 'endpoint_id',
        type: 'string',
        required: true,
        detail: '上一步返回的接口 ID。',
      },
      {
        name: 'known_inputs',
        type: 'array',
        required: false,
        detail: '已知字段引用数组：endpoint、location: { in: ... }、path；不传真实值。',
      },
      {
        name: 'authenticated',
        type: 'boolean',
        required: false,
        detail: '调用者声明已准备当前业务认证，工具不会验证业务登录。',
      },
      {
        name: 'max_depth / max_steps',
        type: 'integer',
        required: false,
        detail: '默认 4/60，最多 8/100；检查 truncated 和缺口。',
      },
    ],
    returns: [
      {
        field: 'steps / gaps / cycles / truncated',
        detail: '有界结果、缺口、循环和未完成标记。',
      },
    ],
    tip: '观察到的使用关系不等于必须按此顺序调用。',
  },
  {
    name: 'read_field_values',
    label: '读取字段观测值',
    description: '读取字段的类型化观测值摘要，或一个值的完整原文。',
    parameters: [
      {
        name: 'project_id',
        type: 'string',
        required: true,
        detail: '发现工具返回的授权项目 ID。',
      },
      {
        name: 'environment_id',
        type: 'string',
        required: false,
        detail: '明确所选环境；目录计数和样本按此范围读取。',
      },
      {
        name: 'endpoint_id',
        type: 'string',
        required: true,
        detail: '上一步返回的接口 ID。',
      },
      {
        name: 'archive_id / field_key',
        type: 'string',
        required: true,
        detail: '使用字段 knowledge.context.observations.archive_id 和字段 key。',
      },
      {
        name: 'value_id',
        type: 'string',
        required: false,
        detail: '省略时读摘要；指定时分块读取该值。',
      },
      {
        name: 'offset / limit / content_offset / max_chars',
        type: 'integer',
        required: false,
        detail: '摘要分页或原文续读；保留类型和原始精度。',
      },
    ],
    returns: [
      {
        field: 'summary / items / has_more',
        detail: '数量、采集状态、类型、来源和摘要。',
      },
      {
        field: 'data / next_offset',
        detail: '指定 value_id 后拼接完整 JSON 原值。',
      },
    ],
    tip: '观测值不是封闭业务枚举，0、false、null、空字符串和空容器不得混淆。',
  },
  {
    name: 'browse_directory',
    label: '探索业务目录',
    description: '从顶层或指定目录逐层探索，Agent 自己选择下一步。',
    parameters: [
      {
        name: 'project_id',
        type: 'string',
        required: true,
        detail: '发现工具返回的授权项目 ID。',
      },
      {
        name: 'environment_id',
        type: 'string',
        required: false,
        detail: '明确所选环境；目录计数和样本按此范围读取。',
      },
      {
        name: 'directory_id',
        type: 'string',
        required: false,
        detail: '省略时从顶层开始；使用返回的目录 ID。',
      },
      {
        name: 'section',
        type: 'string',
        required: false,
        detail: 'directories（默认）列直接子目录；interfaces 列接口摘要。',
      },
      {
        name: 'unclassified / recursive',
        type: 'boolean',
        required: false,
        detail: 'unclassified=true 读取未分类接口；recursive=true 明确查询指定目录子树。',
      },
      {
        name: 'offset / limit',
        type: 'integer',
        required: false,
        detail: '默认 0/20，每页最多 50。按 next 中的工具和参数续读。',
      },
      {
        name: 'revision',
        type: 'string',
        required: false,
        detail: '续读时传回返回的版本；变化后从头重读本次查询。',
      },
    ],
    returns: [
      {
        field: 'items / directory / next',
        detail: '目录名称、介绍摘要、路径、数量或接口摘要。',
      },
      {
        field: 'unclassified / all_interfaces',
        detail: '无正式目录或目录为空时仍有可探索入口。',
      },
      {
        field: 'read_description',
        detail: '通过 read_source_evidence 阅读完整目录介绍。',
      },
    ],
    tip: '成员数量按选定观测环境计算；目录组织本身是项目正式知识。空目录不能证明业务能力不存在。',
  },
  {
    name: 'read_response_material',
    label: '读取响应原文',
    description: '读取选定样本的响应状态、Header、正文和根值。',
    parameters: [
      {
        name: 'project_id',
        type: 'string',
        required: true,
        detail: '发现工具返回的授权项目 ID。',
      },
      {
        name: 'environment_id',
        type: 'string',
        required: false,
        detail: '明确所选环境；目录计数和样本按此范围读取。',
      },
      {
        name: 'endpoint_id',
        type: 'string',
        required: true,
        detail: '上一步返回的接口 ID。',
      },
      {
        name: 'example_id',
        type: 'string',
        required: true,
        detail: 'samples 返回的已保留样本 ID。',
      },
      {
        name: 'part',
        type: 'string',
        required: false,
        detail: 'all（默认）/ headers / body / parsed_body。解析根的 JSON null、未采集、不可读、截断、二进制状态分别表达；旧原文读取保留。',
      },
      {
        name: 'content_offset / max_chars',
        type: 'integer',
        required: false,
        detail: '偏移默认 0；每块默认最多 16384 个字符，可减至 256。拼完所有 data 再解析 JSON。',
      },
      {
        name: 'revision',
        type: 'string',
        required: false,
        detail: '原样使用 next.arguments；来源变化时丢弃旧片段重新读取。',
      },
      {
        name: 'source_record',
        type: 'object',
        required: false,
        detail: '返回的 { batch_id, record_id } 来源标识；样本续读原样传回，不自行构造。',
      },
    ],
    returns: [
      {
        field: 'data / next',
        detail: '可完整续读的响应原文；未采集响应时明确返回 not_captured。',
      },
    ],
    tip: '只读取保留的响应，不调用业务接口验证当前行为。',
  },
  {
    name: 'read_source_evidence',
    label: '核对来源依据',
    description: '读取接口说明、字段或关联依据，或样本保留的页面/操作上下文。',
    parameters: [
      {
        name: 'project_id',
        type: 'string',
        required: true,
        detail: '发现工具返回的授权项目 ID。',
      },
      {
        name: 'environment_id',
        type: 'string',
        required: false,
        detail: '明确所选环境；目录计数和样本按此范围读取。',
      },
      {
        name: 'endpoint_id / directory_id',
        type: 'string',
        required: false,
        detail: '接口证据使用 endpoint_id；完整目录资料使用 directory_id，二者不能混用。',
      },
      {
        name: 'field_key / link_id / example_id',
        type: 'string',
        required: false,
        detail: '接口下最多指定一种证据目标；均省略则读接口说明及来源。',
      },
      {
        name: 'content_offset / max_chars',
        type: 'integer',
        required: false,
        detail: '偏移默认 0；每块默认最多 16384 个字符，可减至 256。拼完所有 data 再解析 JSON。',
      },
      {
        name: 'revision',
        type: 'string',
        required: false,
        detail: '原样使用 next.arguments；来源变化时丢弃旧片段重新读取。',
      },
      {
        name: 'source_record',
        type: 'object',
        required: false,
        detail: '返回的 { batch_id, record_id } 来源标识；样本续读原样传回，不自行构造。',
      },
    ],
    returns: [
      {
        field: 'data / next',
        detail:
          '完整来源文档和 source_reads 精确读取入口；不会提前读取正文，引用失效时再检查样本索引，替代样本不等于原证据。',
      },
    ],
    tip: '核对先后要读 context.completed_at / started_at；observed_at 不等于响应结束，同页面也不一定同 view_id。缺少上下文就保留未知。',
  },
  {
    name: 'inspect_knowledge_coverage',
    label: '检查已知资料缺口',
    description:
      'summary 展示分类汇总和展开入口，issues 可按字段或问题类别读取明细；Agent 按任务选择视图。旧调用仍返回问题列表。',
    parameters: [
      {
        name: 'project_id',
        type: 'string',
        required: true,
        detail: '发现工具返回的授权项目 ID。',
      },
      {
        name: 'environment_id',
        type: 'string',
        required: false,
        detail: '明确所选环境；目录计数和样本按此范围读取。',
      },
      {
        name: 'directory_id / endpoint_id',
        type: 'string',
        required: false,
        detail: '可缩小范围；二者不能同时指定。',
      },
      {
        name: 'section',
        type: 'string',
        required: false,
        detail:
          'summary 看分组统计和 groups[].open；issues + issue_kind 看指定类别。按任务选择，不要求固定读取顺序。省略新参数时保留旧版明细分页。',
      },
      {
        name: 'issue_kind',
        type: 'string',
        required: false,
        detail:
          'interface_description_missing / unclassified / field_description_missing / field_generation_incomplete / field_meaning_unconfirmed / request_material_not_retained / capture_gap。优先使用问题组返回的入口。',
      },
      {
        name: 'field_key',
        type: 'string',
        required: false,
        detail: '与 endpoint_id 一起限定单个字段；不顺带检查无关字段、接口说明或其他样本。',
      },
      {
        name: 'recursive',
        type: 'boolean',
        required: false,
        detail: '指定目录时可明确包含子目录。',
      },
      {
        name: 'offset / limit',
        type: 'integer',
        required: false,
        detail: '默认 0/20，每页最多 50。按 next 中的工具和参数续读。',
      },
      {
        name: 'revision',
        type: 'string',
        required: false,
        detail: '续读时传回返回的版本；变化后从头重读本次查询。',
      },
    ],
    returns: [
      {
        field: 'coverage / groups / items / next',
        detail:
          '汇总区分已有说明、生成已处理、语义确认及采集缺口；每组提供明细入口。生成已处理可以包含明确声明未知，不等于语义已确认。',
      },
    ],
    tip: '只检查已保存资料；没有已知问题不保证业务知识完整或正确。',
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
  if (name === 'read_interface') return { ...target, section: 'overview', offset: 0, limit: 20 }
  if (name === 'browse_directory') return { ...scope, section: 'directories', offset: 0, limit: 20 }
  if (name === 'inspect_knowledge_coverage') return { ...scope, section: 'summary' }
  if (name === 'read_source_evidence') return { ...target, content_offset: 0 }
  if (name === 'read_request_material' || name === 'read_response_material')
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
    title: '查清任务 ID 从哪里来',
    route: '读取字段 → 跟随引用或搜索 → 核对依据',
    tools: 'list_projects / read_interface / search_interfaces / read_source_evidence',
    prompt: `请在「${exampleProjectName}」的测试环境中，查清管理端完成技术咨询任务需要的 taskId 从哪里来。由你选择目录、搜索或字段线索逐步检索；按需核对来源响应、目标请求及采集上下文，同时检查来源接口需要哪些输入。说明已证实的对应、候选来源、适用条件和未知点；不要把同值或时间先后当成必须调用的顺序，不发送业务请求。项目、环境或接口不唯一时再让我选择。`,
  },
  {
    title: '从字段文字找到相关接口',
    route: '搜索字段 → 完整语义 → 提取文字线索 → 核实候选',
    tools: 'list_projects / list_project_environments / search_interfaces / read_interface',
    prompt: `请在「${exampleProjectName}」的测试环境中，找到商机项目的“执行主体来源”字段。如果说明里提到字典或其他接口，请沿引用或文字线索查找。区分搜索命中、可能相关和已有证据支持的来源；如果缺少具体字典编码、数值映射或样本，请保留未知，不猜测数字含义。按需读取，不下载整个项目的原始资料。`,
  },
  {
    title: '分开读取请求与响应',
    route: '样本索引 → 所需原文部分 → 来源核对',
    tools:
      'list_projects / read_interface / read_request_material / read_response_material / read_source_evidence',
    prompt: `请在「${exampleProjectName}」中，先与我确认环境，选择一份实际保留的调用样本。先只读取请求 Header，再按需要读取 URL、query 和正文；随后独立读取同一样本的响应 Header 和正文。长内容续读到完整后再解析，报告采集状态与来源，不发送业务请求。`,
  },
  {
    title: '理解陌生项目',
    route: '发现项目与环境 → 目录探索 → 按需展开',
    tools: 'list_projects / list_project_environments / browse_directory / read_interface',
    prompt: `请帮我了解「${exampleProjectName}」有哪些业务功能和主要接口。由你决定如何查找、哪些模块值得深入，以及需要读取哪些资料。利用知识库可逐层展开的结构减少无关读取，需要全貌或更多依据时继续扩大范围。报告依据、未读范围和资料缺口。`,
  },
  {
    title: '准备真实 HTTP 请求',
    route: '发现项目与环境 → 搜索 → 请求资料',
    tools:
      'list_projects / list_project_environments / search_interfaces / read_interface / read_request_material',
    prompt: `请在「${exampleProjectName}」中找到“创建技术咨询单”接口，准备一份包含地址、方法、Header、query 和请求体的请求草案。由你选择检索路线；环境不明确时与我确认。资料缺失或需要当前业务登录信息时请说明，先不要发送请求。`,
  },
  {
    title: '查看目标资料还缺什么',
    route: '定位接口 → 覆盖汇总 → 相关问题组或字段',
    tools:
      'list_projects / list_project_environments / search_interfaces / inspect_knowledge_coverage',
    prompt: `请检查「${exampleProjectName}」测试环境中管理端完成技术咨询任务的资料，重点说明任务 ID 字段或请求采集有关的缺口，其他问题按数量说明即可。由你选择适合的读取范围与路线。分别说明生成是否已处理、语义是否确认、原始资料是否完整；不要把候选说明说成生成失败，也不要保证整个项目已经完整。`,
  },
] as const
export const mcpFaqs = [
  {
    question: 'Agent 一定要从目录查起吗？',
    answer:
      '可以按任务选路。陌生项目先看目录；已知名称或路径直接搜索；字段命中直接读完整语义，再沿引用或文字线索查来源。路线可以交替，足够回答时说明依据和未读范围即可。',
  },
  {
    question: 'field_summary 会省掉字段说明吗？',
    answer:
      '不会截短业务语义。它保留完整说明、补充含义、未知点和状态；证据正文、完整关系、观测原值及完整快照按入口另读。字段树上的说明才是预览。',
  },
  {
    question: '来源字段和请求值相同，就能确认必调顺序吗？',
    answer:
      '不能。还需按任务核对环境、来源身份和采集上下文；判断先后比较来源 completed_at 与目标 started_at。不同 view_id 不能说成同一视图操作，来源输入和多记录选值规则也可能仍待确认。',
  },
  {
    question: '有说明但仍待确认，是整理失败吗？',
    answer:
      '生成完成、业务语义确认和采集完整度分别统计。说明已生成仍可为 candidate，明确记录未知也可能已完成处理；可用覆盖汇总了解分布，也可针对相关字段或问题类别查看明细。',
  },
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
      '优先原样使用 next 中的工具及参数续读，直到 has_more=false；只拼接同一 revision 的 data 再解析 JSON。Header 原始名称、值及重复项保留，历史认证的有效性仍未确认。',
  },
  {
    question: 'Agent 读到的说明都是真实观测吗？',
    answer:
      '事实来自采集；整理后的名称、用途、字段语义与关联保留来源及确认状态。LLM 解释不是新的独立事实，重要结论要回到样本、环境和时间核对。',
  },
  {
    question: 'MCP 会执行或修改业务接口吗？',
    answer: '这些工具只读取授权项目、环境、知识和请求资料，不发起业务请求，不自动应用候选文档。',
  },
] as const

export const mcpSearchText =
  '\n\n## 把检索交给 Agent\n' +
  Object.values(mcpPurpose).join('\n\n') +
  '\n\n' +
  mcpRetrievalPaths.map((item) => `### ${item.title}\n${item.route}\n${item.detail}`).join('\n\n') +
  '\n\n' +
  mcpReadingRules.map((rule) => `- ${rule}`).join('\n') +
  '\n\n' +
  mcpTools
    .map(
      (tool) =>
        `## ${tool.name}\n${tool.description}\n${tool.parameters.map((p) => `${p.name} ${p.type} ${p.required ? '必填' : '可选'} ${p.detail}`).join('\n')}\n${tool.returns.map((r) => `${r.field} ${r.detail}`).join('\n')}\n${tool.tip}`,
    )
    .join('\n\n') +
  '\n\n## 可复制的业务提问\n' +
  mcpScenarios.map((scenario) => `### ${scenario.title}\n\n${scenario.prompt}`).join('\n\n') +
  '\n\n' +
  mcpFaqs.map((faq) => `${faq.question}\n${faq.answer}`).join('\n\n')
