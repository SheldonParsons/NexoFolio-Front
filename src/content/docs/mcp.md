# NexoFolio MCP 接入与使用

## 已提供的 MCP 能力

当前源码提供七个只读工具：list_projects、list_project_environments、search_interfaces、read_interface、read_request_material、trace_dependencies、read_field_values。实际服务以 initialize 和 tools/list 返回的信息为准。工具不会执行业务 HTTP 请求，不会启动整理，也不会自动应用候选文档。

凭证管理已经实现。登录后，从头像菜单或顶部“接口文档”菜单进入 [MCP 凭证页面](/settings/mcp)，填写名称、创建当前账号自己的独立 Token。支持多个 Token、自选开始和结束时间或无限期，并可单独撤销。列表展示未生效、有效、已过期、已撤销四种状态。完整 Token 仅创建成功时显示一次；丢失后请撤销并新建。网页登录 Token 仅用于管理凭证，不能用来连接 MCP。

Token 访问所属账号在本平台当前有权限的所有项目，不按项目分别分发。外部禅道权限变化沿用既有登录同步机制；MCP 不主动执行权限同步。list_projects 无需项目 ID，返回当前账号有权限的项目；项目环境和知识工具使用它返回的 project_id。未生效、过期、撤销、账号禁用或无项目权限时均不能读取。接口名称和解释来自已保存的正式知识，候选内容必须明确应用后才进入正式知识。

凭证页提供当前实例服务地址、传输方式、支持的协议版本和当前账号可访问项目数；权限待同步或读取失败时会明确提示。协议版本由当前后端声明并在初始化时协商，本页不写死单一版本。

## 用文档链接开始接入

可以对有本机配置能力的 Agent 说：“帮我安装这个 MCP：[本文](/docs/mcp)”。页面的“复制开场”会自动填入当前文档 URL、MCP 服务 URL、凭证入口，以及已选项目/环境的 ID。配置模板也会预填服务地址，唯一需要用户在客户端填写的凭证是自己创建的 MCP Token。无需执行前端脚本的完整参考版本在 [mcp.md](/mcp.md)。

文档和凭证页共用实例的 API 配置，按当前访问域名与配置的 API 前缀追加 /mcp，自动生成协议地址；API 独立部署时保留配置的后端域名。静态参考里的同源相对链接按本文域名解析成完整地址。/docs/mcp 是文档，不是协议端点；不能用文档 URL 连接 MCP。

使用支持 Streamable HTTP 和自定义 Authorization Header 的客户端。认证字段为 Authorization: Bearer YOUR_MCP_TOKEN，YOUR_MCP_TOKEN 仅是占位符。当前实现不是完整 OAuth 自动发现和浏览器登录流程；仅支持 OAuth 的客户端需要额外接入能力，不能宣称已经兼容所有客户端。

本文没有可安装的 npm 包或可执行安装脚本。不要据此运行虚构的 npx 命令。不同客户端的配置格式和配置位置不同；应保留其他 MCP 配置，只添加或更新 nexofolio 项，并由用户在客户端本地完成凭证填写。

127.0.0.1 是运行 Agent 的机器自身。云端 Agent 无法直接读取用户电脑的本地开发地址；发布后应给它可访问的线上文档链接和实际服务地址。

## 读取接口与请求资料

先调用 list_projects（参数可为空），按返回的 name 确认用户目标，取得 project_id；再调用 list_project_environments，传入 project_id，取得该项目的 environment_id 和环境名称。两个工具均支持 offset/limit（默认 0/20，limit 最多 50），返回 items、total、offset、limit、has_more、next_offset。has_more=true 时将 next_offset 作为下一次 offset，直到分页读完。无权限项目不会出现在项目列表中，也不能读取它的环境。

项目重名或多个环境匹配时，请用户选择具体名称，不要求用户手工查 ID，不自行猜测 UUID。项目列表为空表示当前没有可访问项目；环境列表为空表示该项目没有已配置环境。环境存在不代表已采集接口。权限和 token 状态在每次调用时重新校验，分页过程中权限变化也会影响后续结果。

随后把得到的 project_id、environment_id 传给 search_interfaces。搜索匹配多个接口时确认目标；支持方法、路径、已保存名称与用途搜索，query 为空时分页列出接口。项目名称匹配通过 list_projects 返回的名称完成，不把名称冒充 project_id。

read_interface 的字段、关系和请求资料引用分别分页：field_offset 对应 fields_has_more；link_offset 对应 links_has_more；offset 对应 request_material_has_more。每个列表独立续读，limit 默认 20、最多 50，不能用一页结果证明某项不存在。environment_id 过滤请求资料引用，不能假设整份字段和关系详情均已按环境过滤。

从 request_materials 选择同一环境的 example_id，调用 read_request_material。返回非空 source_record 时，后续请求原样传回该来源及返回的 next_offset，直到 has_more=false；仅拼接同一来源的 data，再解析完整 JSON。若出现 SOURCE_CHANGED_RESTART_READ，丢弃旧片段并从 0 重读，不能混用不同调用记录。历史资料无来源 ID 时不能宣称已固定来源。偏移按返回值使用，不自行按字节或 JavaScript 字符长度推算。

资料包含已保存的 URL、方法、query、请求 Header、正文状态与根值、响应 Header、环境和来源。Header 保留原始名称、值与重复项。none、完整空对象 {}、partial 摘要、unreadable、truncated 各有不同含义，不能根据 POST 等方法猜正文。页面可见 Header 不代表最终网络 Header 全部可见；multipart 摘要不含文件字节。

## 输入来源与观测值

trace_dependencies 的 known_inputs 每项描述已知字段：endpoint、location: { in: path/query/request_header/request_body }、path。它不接收该字段的真实值。authenticated 是用户声明已有当前业务认证，不是服务验证登录成功。多环境目标必须明确环境；有来源的观测关系不一定是强制前置调用，truncated=true 也不代表依赖已读完整。

read_field_values 使用 read_interface 返回字段的 key，以及 knowledge.context.observations.archive_id。值摘要按 offset/limit 分页；指定 value_id 后按 next_offset 分块读取原值 JSON，直至 has_more=false。保留类型、环境、来源、原始数值精度和采集状态，不能把摘要当完整原值。观测值不是封闭业务枚举。

历史业务凭据不代表当前可用，NexoFolio MCP 凭证与业务认证分开。缺少当前认证或完整采集时，列出缺口，不制造登录链。facts 是采集事实，整理解释保留来源与确认状态；LLM 解释不是新观测。

## 接入验收与故障定位

- 保存配置：只说明客户端配置已修改。
- 协议连通：initialize 成功、tools/list 返回当前七个工具。
- 授权可用：依次调用 list_projects、list_project_environments，再用返回的 ID 调用 search_interfaces；返回空列表与权限拒绝是不同结果。
- 资料可读：选真实接口，验证独立分页、请求资料续读与环境/来源；没有样本时说明该项尚未验证。
- 对话可用：按下面的具体场景输出带来源的请求草案和缺口清单。工具列表正常不能证明这一层已经通过。

401 / UNAUTHENTICATED：核对 MCP 凭证是否有效、过期、撤销以及账号是否启用。PROJECT_ACCESS_DENIED：核对该账号当前项目权限。tools/list 为空：服务可能未装配知识导航能力，不是项目目录为空。SAMPLE_NOT_RETAINED / VALUE_UNAVAILABLE：当前来源不可读，不能伪造原文。OUTPUT_TOO_LARGE：缩小 limit/max_steps 后继续分页。

项目和环境发现已提供；项目知识完整性审计和可查询的 MCP 工具调用审计尚未提供。不要把“没有问题记录”或“已读完分页”描述成“项目知识已经完全正确”。

协议参考：[Streamable HTTP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)、[工具发现与调用](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)、[授权流程](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)。
