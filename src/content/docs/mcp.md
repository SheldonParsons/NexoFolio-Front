# NexoFolio MCP 接入与使用

## 把查找接口资料交给 Agent

你只需告诉 Agent：哪个项目、哪个环境，以及想解决什么问题。

NexoFolio 把接口资料组织成可以逐层展开的知识库，提供目录、搜索、字段说明、关联和原始样本等入口。Agent 根据你的问题，自主决定从哪里开始、沿哪些线索继续、需要读到多深，以及何时停止。平台提供资料结构与核对信息，检索决策交给 Agent。

这套结构让 Agent 可以找到相关范围，再取得当前需要的内容，减少无关资料占用上下文和重复读取。需要核实时，也能继续读取完整说明、关联依据和原始请求、响应；问题需要全貌时，可以扩大范围或完整读取。这就是渐进式披露的收益：信息按需展开，支撑结论的关键资料仍可读全。

资料同时保留来源、采集环境与时间、确认状态和已知缺口，帮助 Agent 判断哪些结论有依据、哪些仍需确认。它可以根据这些信息调整检索范围和深度，回答时说明依据与影响结论的未知点。

你不用提前查 ID，也不用安排工具调用顺序。可以直接说：

> 帮我查清商用订单管理系统测试环境里，完成技术咨询任务的 taskId 从哪里来。你自己决定怎么找，说明依据和还没确定的地方。

当前提供 11 个只读工具。它们不发送业务 HTTP 请求、不运行整理模型、不启动整理，也不应用或废弃候选结果。名称和说明来自已保存的正式知识；候选整理内容需要应用后才进入这份知识。

服务连接时通过 `instructions` 提供整体理念、结构用途和使用原则，工具定义说明各入口的能力和参数，具体项目资料在调用后逐步返回。客户端负责组织模型实际接收的内容；接入文档仍需由 Agent 主动阅读。

## 先创建凭证，再交给 Agent 接入

登录后，从头像菜单或顶部“接口文档”菜单进入 [MCP 凭证页面](/settings/mcp)，创建当前账号自己的独立 Token。支持多个 Token、有效时间区间或无限期，可逐个撤销。完整 Token 仅创建成功时显示一次，丢失后请撤销并新建。网页登录 Token 仅用于管理凭证，不能用来连接 MCP。

凭证访问当前账号在本平台有权限的项目。外部禅道权限变化沿用登录同步机制，MCP 不主动同步权限。未生效、过期、撤销、账号禁用或无项目权限时不能读取对应资料。凭证页会展示当前服务地址、传输方式、协议版本和可访问项目数。

可以直接对有本机配置能力的 Agent 说：“帮我安装这个 MCP：[本文](/docs/mcp)”。网页的“复制开场”自动带入当前文档、MCP 服务和凭证管理地址；已有项目上下文时也会带入范围。无需执行 JavaScript 的完整参考在 [mcp.md](/mcp.md)。

服务地址使用当前实例的 API 配置，追加 `/mcp`；独立部署的 API 保留其后端域名。静态参考中的相对地址按本文域名解析。`/docs/mcp` 是文档，不能作为协议地址。`127.0.0.1` 指运行 Agent 的机器自身，云端 Agent 需要可访问的线上地址。

客户端需支持 Streamable HTTP 和自定义 `Authorization: Bearer YOUR_MCP_TOKEN`。只添加或更新 `nexofolio` 配置，保留其他 MCP；真实 Token 由用户在客户端本地填写，不在对话中回显。本服务没有需要安装的 npm 包，也没有完整 OAuth 自动发现和浏览器授权流程；不要运行虚构的 npx 安装命令，具体配置格式使用客户端实际支持的格式。

## 如何选择读取路线

项目或环境尚未确定时，可以用 `list_projects` 和 `list_project_environments` 按名称取得真实 ID；已有明确范围时可以继续使用。同名且影响判断时请用户选择；不要让用户手工查 UUID，也不要根据域名猜环境。下面介绍各入口的用途，具体路线由 Agent 根据问题选择。

| 想解决的问题               | 可以从哪里开始                                | 什么时候继续展开                             |
| -------------------------- | --------------------------------------------- | -------------------------------------------- |
| 了解陌生项目有哪些功能     | `browse_directory` 浏览目录介绍和直接子目录   | 选择相关目录，再读取其中的接口概览           |
| 找已知名称或路径的接口     | `search_interfaces` 默认接口搜索              | 命中后按任务读概览、字段或样本               |
| 找使用某个字段或含义的接口 | `search_interfaces(search_in=fields)`         | 沿 `matched_field.open` 直接读完整字段语义   |
| 字段说明提到其他接口       | `read_interface(section=field_summary)`       | 有已保存引用就跟随；只有文字线索就搜索并核实 |
| 核对真实取值或参数来源     | 相关关系的证据入口                            | 读取明确引用的请求、响应和上下文             |
| 看还有哪些资料缺口         | `inspect_knowledge_coverage(section=summary)` | 只展开相关问题组或精确字段                   |

这些路线可以交替使用。精确字段已经命中时，无需再读一遍所属接口概览；需要接口整体用途、目录或流量时再读。达到任务所需依据后可以停止，并说明结论覆盖了什么、哪些资料还没有读取。只有在声称“全部”或“不存在”时，才需要确保相关范围已经查全。

搜索使用忽略大小写的字面匹配，多个空白分隔词需要同时匹配。自然语言没命中时，可以缩短关键词、改查路径、字段或目录；一次空搜索不能证明接口不存在。字段搜索查已保存的字段名称与说明，未整理字段仍可从接口的 `fields` 发现。可选 `view=grouped` 在同页合并接口/目录，字段保留精确 key、完整动作和 match_offset；分页按字段命中数计算。精确 key/名称优于身份词/说明命中，同级稳定，低优先级结果不隐藏。

## 目录、字段树与完整说明

`browse_directory` 不传 `directory_id` 就从根开始。`section=directories` 列直接子目录，`section=interfaces` 列直接接口；`recursive=true` 才包含子树。`unclassified=true` 读取未分类接口，不能同时指定目录。目录为空时仍可沿返回的 `unclassified` 或 `all_interfaces` 入口继续查。

目录组织属于项目正式知识，接口计数和成员按所选观测环境过滤。根级子目录数与项目目录总数不是同一数量，目录有接口也不代表已读过其详情。

`read_interface` 每次明确选择需要的部分：

| section         | 读取什么                                               |
| --------------- | ------------------------------------------------------ |
| `overview`      | 接口名称、用途、目录与后续入口，不加载原始 HTTP 样本   |
| `description_summary` | 完整主说明、用途和未知点，折叠重复认证观测与详细坐标 |
| `description`   | 完整接口说明                                           |
| `fields`        | 根字段或 `parent_key` 的直接子字段                     |
| `field_summary` | 精确字段的完整语义、未知点、状态及少量引用             |
| `field`         | 精确字段的完整资料快照，保留旧读取能力                 |
| `relations`     | 已保存关联，可按字段和 incoming / outgoing / both 筛选 |
| `samples`       | 已保留样本的索引，不先下载所有正文                     |

字段节点的 `key` 包含位置和路径，例如 `request_body:id` 与 `response_body:200:id` 是两个字段。`open` 读取语义；只有 `children>0` 的节点有 `expand`，用于展开子字段。树上说明是预览，完整说明通过 `open` 读取，不应把预览当作全部内容。完整结构化路径仍可在 `field_summary` 或 `field` 中取得。

`field_summary` 虽然名称带 summary，但保留完整字段说明、补充含义和未知点，不截短业务语义。证据正文、全部关系、观测原值和生成元数据另有入口，需要时再展开。已经取得所需关联引用时，无需重复查询同一份关系列表。

字段搜索返回所属接口的方法、路径、名称、用途和目录，以及命中字段的名称、说明预览、精确 key 和 `matched_field.open`。它省去重复的接口概览动作与逐环境流量数组；接口模式搜索仍保留这些资料。

`overview` 中 `field_count` 或 `sample_count` 为 null 表示尚未读取，不是 0；`documented_field_count` 是已保存字段说明数。字段事实和说明可能来自多次或多个环境的观测，应核对环境标签、来源及 `scope_note`，不把整份文档自动归为所选环境事实。

## 从字段线索核对参数来源

字段中有已保存关联时，可以直接沿返回的工具与参数跳到来源接口或证据。仅有“需查字典”“参考某接口”等文字时，由 Agent 提取词语搜索，继续核实。搜索命中、语义上可能相关、已有样本支持和业务已确认，是不同层次。

`read_source_evidence` 一次选择接口说明、目录介绍、精确字段、关联或样本上下文之一。它的 `source_reads` 给出已有明确引用的请求、响应和上下文入口，可以直接读取，不必先枚举已知样本。`availability=not_prefetched` 表示尚未读取，不能保证引用现在仍有效。引用缺失、失效或需要比较样本时，再用 `fallback_samples` 或样本索引；替代样本不能冒充原引用。

核对来源关系时，按问题需要分别检查：

1. 两端资料的 `observation_key` / `source_record` 是否对应引用，环境是否一致。
2. 来源响应字段与目标请求字段是否同值、同类型，是否有配套记录可以辨认。
3. 页面、客户端、`view_id` 和时间是否支持所声称的操作范围。
4. 来源接口自身需要哪些输入，这些输入是否已经有可靠来源；多条返回记录时如何选值。

需要判断调用先后时，读取采集上下文，比较来源 `context.completed_at` 与目标 `context.started_at`。`observed_at` 不能单独当作响应完成时间。同页面不一定同视图，不同 `view_id` 的 `seq` 不能拼成一个调用序列。信息缺失就保留未知。

样本同值且来源更早，可以支持当前样本的关联；仍不能证明前端赋值过程、唯一来源或“必须先调用”。保留返回的适用条件和 observed / candidate / confirmed 等状态。没有具体字典编码和数值映射时，也不能只凭通用字典接口解释一个编码。

`trace_dependencies` 可对已保存的输入来源关系做有界追踪；也可通过 `relations` 自己逐步查。`known_inputs` 每项使用 endpoint、location: { in: ... }、path 描述已知字段，不传真实值；`authenticated` 只是调用者声明已有当前业务认证。检查 gaps、cycles 与 truncated，不把有界结果当作全量调用链。

## 生成完成、语义确认与采集完整度

`inspect_knowledge_coverage` 的 `section=summary` 展示统计和 `groups[].open`，`section=issues` 可读取相关问题组。希望了解总体分布时可以看汇总，已有明确疑点时可以直接查相关明细，顺序由 Agent 决定。用 `endpoint_id + field_key` 可以只检查一个字段，不附带检查所有其他字段或样本。

| 维度           | 回答的问题                          | 不能据此推断                                       |
| -------------- | ----------------------------------- | -------------------------------------------------- |
| 生成处理       | 名称和说明是否已按本轮要求处理      | 生成完成不等于业务语义已确认                       |
| 名称与语义确认 | 内容是候选还是已确认，依据是什么    | candidate 不等于生成失败，也不等于整理轮次尚未应用 |
| 采集完整度     | 请求、响应、Header 和来源有哪些缺口 | 有字段说明不等于原始调用已经采集完整               |

明确写出未知及原因，也可能属于已完成的生成处理。`capture_inspected=false` 表示本次没有检查采集资料。问题数量可能重叠，不是独立字段数，更不是业务失败数。没有已知问题只能描述本次检查范围，不能保证整个项目知识完整或正确。

支持的问题类别为：interface_description_missing、unclassified、field_description_missing、field_generation_incomplete、field_meaning_unconfirmed、request_material_not_retained、capture_gap。优先跟随实际返回的问题组入口，避免自行拼错范围。

## 分页与长资料怎么读

列表默认 `offset=0, limit=20`，limit 允许 1–50。首次通常省略这两个参数；不要为了查全把 limit 改成 100。目录、搜索和各类明细各自分页，`has_more=true` 就还有未读内容。

有 `next` 时原样使用 `next.tool` 和 `next.arguments`；项目/环境发现等返回 `next_offset` 时，将其作为下一次 offset。长文档返回 `encoding=json_text_chunks`，按同一 `revision` 收齐全部 `data` 后再拼接、解析 JSON。`max_chars` 默认 16384，允许 256–16384 个 Unicode 字符；偏移使用返回值，不自行计算字节或 JavaScript 字符长度。

`revision` 约束当前读取操作，不是整个项目的永久快照，不应传给另一工具或另一 section。`SOURCE_CHANGED_RESTART_READ` 表示范围或资料变化，应丢弃该次旧片段并从 0 重读。调用次数和最近调用时间等实时统计不会冻结；保留的 `source_record` 也要原样用于样本续读。

`read_request_material` 支持 all / headers / url / body / parsed_body；`read_response_material` 支持 all / headers / body / parsed_body。parsed_body 只表达解析根一次，保留采集/完整状态与同记录原文入口；切换表示不复用旧 revision。优先读需要的部分，正文保留原文、根值和采集状态。未发送正文、完整空对象 `{}`、partial 摘要、unreadable、truncated 与响应未采集 `not_captured` 分别表达。Header 保留原始名称、值及重复项，页面可见 Header 不代表浏览器自动添加的头已完整捕获；multipart 摘要不含文件字节。

`read_field_values` 使用字段 key 和 `knowledge.context.observations.archive_id` 读取观测摘要，指定 value_id 后可续读原值 JSON。0、false、null、空字符串和空容器应分别保留。观测值不是封闭业务枚举，历史业务认证也不代表当前仍有效；MCP 凭证与业务系统登录凭证分别使用。

## 旧客户端兼容

新客户端显式选择 section。省略 `read_interface.section` 的旧调用保留组合响应，fields、links 和 request_materials 独立分页：field_offset 对应 fields_has_more，link_offset 对应 links_has_more，offset 对应 request_material_has_more。环境参数不能保证旧组合响应里的全部字段和关系都专属于该环境。

没有使用新参数的覆盖检查仍返回旧问题明细分页。旧 `field` 完整快照和字段值读取方式继续保留；新调用建议使用完整语义与问题汇总入口，按任务选择资料。

## 接入验收与故障定位

- 配置保存：仅说明客户端配置已修改。
- 协议连通：initialize 成功，并读取实际 tools/list。当前是 11 个工具，更新后数量不变也可能仍缓存旧定义，应确认 field_summary、coverage summary/issues 与字段筛选能力。
- 授权可用：发现真实项目和环境，再进行一次目录浏览或搜索。空列表和权限拒绝应分别报告。
- 场景可用：让 Agent 自主完成一个真实业务问题，展示依据和未知点；只看“已连接”或工具列表不能替代这一步。

INVALID_BOUNDS 返回具体参数范围和建议值；字符串过长通过 actual_length / maximum_length 表达。优先省略不需要调整的分页/块大小，续读照抄实际下一跳。

401 / UNAUTHENTICATED 时检查凭证的有效时间、撤销状态和账号；PROJECT_ACCESS_DENIED 检查项目权限。SAMPLE_NOT_RETAINED / VALUE_UNAVAILABLE 表示原资料不可读，不能补造原文。SECTION_ARGUMENT_MISMATCH 表示读取部分和参数不匹配；DIRECTORY_NOT_IN_PROJECT / ENDPOINT_NOT_IN_PROJECT 需要回到当前项目重新定位对象。OUTPUT_TOO_LARGE 时选择更具体的 section、缩小范围或单页大小。

报告实际读到什么、哪些结论来自正文或上下文、哪些仍是候选，以及没有继续读取的范围。调用数量不等于工具种类数；返回字符数不等于模型 token；并行调用耗时之和不等于端到端时间。缺少客户端统计时标为未知。

协议参考：[Streamable HTTP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)、[工具发现与调用](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)、[授权流程](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)。

## 废弃内容与历史读取

废弃是项目范围内的可撤销状态，与证据确认状态独立。`project_lifecycle` 提供当前版本、已核对版本、直接废弃数和待核对提示；`target_lifecycle` 与条目 `lifecycle` 标明对象状态。

目录浏览、接口搜索和接口读取支持 `include_retired:true`，也可以直接沿返回的历史展开动作继续。精确读取废弃接口或字段仍能取得历史资料；`read_source_evidence` 可核对废弃原因、操作人和时间。状态变化后旧分页/分块 revision 会失效，应重新开始该次读取。

`retired_source_count` 或“关联来源已废弃”表示需要重新判断依据，不表示引用方自动失效。原始请求与响应保持原内容。所有 11 个工具仍只读，废弃、撤销、整理和应用请在有项目权限的网页中操作。详见 [废弃与撤销废弃](/docs/retirement)。

## 紧凑说明与关系证据

`read_interface` 的 `description_summary` 保留全部已保存主说明、用途、未知点、取值条件和文字关联线索。
认证按环境、载体、scheme、确认状态和捕获完整度等边界合并重复观测，保留计数，不返回可复用凭证。
详细来源坐标可沿 `sources.full` / `sources.evidence` 展开；`not_prefetched` 表示尚未读取原文。
`description` 仍返回旧全文，长文仍按同一 revision 分块；紧凑说明、全文、字段和样本均可直接读取。

关系的 `evidence_assessment` 说明观测支持、歧义和未证明项，`record_pairs` 保留来源/目标记录及行位置。
来源响应完成早于目标请求开始，只是时间证据；同值、多字段对应、同页面均不能证明客户端赋值因果。
多个来源记录同样匹配时保留歧义；旧关系缺少新判据时保持有限/未知，不假装已经重验。
观测确认态、语义确认态和生成完成度相互独立；来源候选不等于唯一来源、后端必填或必调。

客户端应收齐同版本文档，拼接解析并保存，再展示任务所需内容；避免一次打印多份长文档造成宿主截断。
这些结构不指定搜索或目录的优先级，也不保证 Agent 会选择某条路线；实际收益需要相同问题与资料版本的检索对照。
