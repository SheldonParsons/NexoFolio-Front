## 什么时候使用

这页讲的是：怎样把已有的接口资料保存到 NexoFolio 项目里。

| 你想做什么                                              | 使用什么                                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 在浏览器里操作业务页面，记录接口调用                    | 使用 [Fetcher 插件](/docs/fetcher)，按项目和环境名称选择即可，不需要自己写 JSON |
| 接入网关日志、抓包结果、测试脚本或 Swagger/OpenAPI 资料 | 由接入程序调用本文的录入接口                                                    |
| 让 Agent 查询项目和接口知识                             | 使用 [MCP](/docs/mcp)，它负责读取，不是录入入口                                 |

录入时如实提交你拿到的请求、响应或接口结构，不需要先给接口分类，也不需要自己编写字段解释。

## 给 Agent 的阅读与开发要求

这份文档也供开发接入程序的 Agent 直接阅读。完整文本入口为 [api.md](/api.md)，不依赖网页脚本或交互编辑器；接入规范包包含 JSON Schema、完整示例和 SHA-256 清单。

1. 先阅读本文全部规则及规范包，再确认用户的数据来源、开发语言、目标项目和环境。已有代码先读再改，不假设需要安装额外的客户端包。
2. 按项目和环境名称使用平台上下文或 MCP 查询真实 ID。批次与记录 UUID 由程序生成；不得把本文示例的项目、地址或 ID 当成用户的真实数据。
3. 实现组包、JSON/大小校验、原批次持久保留、断网/限流退避，以及按批次和记录核对回执。HTTP 200 也须处理 rejected；仅清理确认已接收项，保留失败原因。
4. 重试使用同一批次、记录编号和相同内容。改内容或拆批使用新批次，避免把已接收记录再次录入。完整/截断/局部摘要/不可读取/无正文如实区分，保留 Header 重复项，不补造缺失数据。
5. 先用虚构数据验证全部接收、部分拒绝、429/503、断网与批次 ID 冲突。产出代码、使用说明、验证计划和仍缺的信息；未经用户明确要求，不向实际实例发送录入，也不替用户启动整理或应用候选文档。

## 录入以后会怎样

1. **录入资料**：服务端保存记录，并返回哪些记录已接收、哪些被拒绝。
2. **提取结构**：平台根据已保存资料提取接口、请求/响应字段和观测值。没有采到的内容仍是未知。
3. **整理候选文档**：在项目中点击“整理文档”，生成供审阅的名称、说明、目录等候选内容。
4. **审阅并应用**：用户确认后应用到现行文档，供后续查询和 MCP 使用。

“录入成功”不等于“整理完成”，更不等于“已应用到正式文档”。原始事实可用于查看结构；整理生成的说明和目录需要审阅后应用，新上传的资料不会替用户自动应用候选结果。

## 快速开始

自建工具只需完成四步：确定项目和环境 → 准备一批 JSON → 发送 → 处理回执。

录入请求不需要 `Authorization`，也不使用 MCP Token；请求头填写 `Content-Type: application/json`。`platform` 是来源工具的名称，例如 `gateway-log-export`，不是账号或令牌。页面会按当前实例预填服务地址，下面的交互演练只做格式校验，不会实际发送。

```bash
curl -X POST "$NEXOFOLIO_URL/v1/collect/batches" \
  -H "Content-Type: application/json" \
  --data @batch.json
```

下面的 `batch.json` 演示如何描述一次调用，里面的业务地址和项目 ID 是示例。实际使用时换成你要录入的项目和真实采集数据。环境可以按名称填写；名称不存在时服务端会在该项目中创建，所以不要随意猜环境。

```json
{
  "batch_id": "7c1e4b52-0f3a-4d8e-9b61-2a5c8d9e0f13",
  "platform": "gateway-log-export",
  "platform_version": "1.4.2",
  "target": {
    "project_id": "5b0f6a52-1c2d-4c8e-9f35-2a1d7c9e4b10",
    "environment": { "name": "测试环境" }
  },
  "records": [
    {
      "id": "e4a9c2d1-6b7f-4e30-8a15-9c2d4e6f8a01",
      "kind": "http_exchange",
      "version": 1,
      "observed_at": "2026-09-24T08:00:00.123+08:00",
      "payload": {
        "request": {
          "method": "GET",
          "url": "https://shop.example.com/api/orders/1001?expand=items",
          "headers": {
            "state": "partial",
            "entries": [["Accept", "application/json"]]
          },
          "body": { "state": "none" }
        },
        "response": {
          "status": 200,
          "headers": {
            "state": "partial",
            "entries": [["Content-Type", "application/json"]]
          },
          "body": {
            "state": "full",
            "media_type": "application/json",
            "encoding": "utf8",
            "content": "{\"id\":1001,\"status\":\"paid\",\"items\":[]}"
          }
        }
      }
    }
  ]
}
```

HTTP 200 会返回回执。下面这个例子中 `accepted: 1`、`rejected: []` 表示这一条已接收。程序需先核对回执的 `batch_id` 对应当前批次，再确认每条记录的结果；不能只看到 HTTP 200 就把整批本地记录删除。

```json
{ "batch_id": "7c1e4b52-0f3a-4d8e-9b61-2a5c8d9e0f13", "accepted": 1, "rejected": [] }
```

## 批次

| 字段               | 必填 | 说明                                                                                              |
| ------------------ | ---- | ------------------------------------------------------------------------------------------------- |
| `batch_id`         | 是   | UUID，由你生成。重试同一批次时必须原样复用                                                        |
| `platform`         | 是   | 来源工具，例如 `nexofolio-fetcher`、`swagger-sync`。小写字母、数字、`.`、`_`、`-`，最多 64 个字符 |
| `platform_version` | 否   | 来源工具的版本，最多 64 个字符                                                                    |
| `target`           | 是   | 这一批记录属于哪个项目和环境，见下一节                                                            |
| `records`          | 是   | 1 到 50 条记录                                                                                    |

可以把批次理解成一个“快递包”：`batch_id` 是包裹编号，`platform` 是寄件工具，`records` 是里面的记录。编号由程序生成 UUID，不需要操作人员背下或手填。一次发送失败重试时，保留同一份文件和编号。

`platform` 只用于标记来源、统计和限流，不代表身份。批次和记录不允许添加规范未定义的字段。

## 归属

`target` 就是“保存到哪里”：项目相当于业务系统，环境相当于该系统的测试环境、正式环境等。服务端按这里的值保存，不根据请求域名猜归属。

普通用户在 Fetcher 中按名称选择即可。自建程序可以通过 MCP 的 `list_projects`、`list_project_environments` 按名称取得真实 ID，或复用平台已有的项目选择结果；不要编造 UUID，也不要把示例 ID 当成自己的项目。

| 字段          | 说明                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| `project_id`  | 必填。项目必须已经存在                                                                                       |
| `environment` | `{ "id": "…" }` 或 `{ "name": "…" }`，二选一。按 `id` 指定时必须属于该项目；按 `name` 指定时不存在会自动创建 |
| `site`        | 可选。`{ "origin": "https://shop.example.com", "prefix": "/" }`，记录采集时所在的站点入口                    |
| `source_url`  | 可选。声明来源的文档地址，例如 Swagger 的 `api-docs` 地址                                                    |

批次里只要有一条调用记录，就必须填写 `environment`。只提交接口声明时可以省略，表示这些声明对项目的所有环境都有效。

环境名区分大小写，不做归一化，首尾不能有空白，也不能包含控制字符。`site` 只作为环境的标注，不参与接口身份。

> 同一个接口由项目、方法和路径模板确定，不包含域名和环境。同一接口在测试环境和正式环境的调用会汇总到一起；来自不同平台的接口，应该提交到不同的项目。

## 记录

每条记录都有相同的外层字段，`payload` 的内容由 `kind` 决定。

| 字段          | 说明                                                                     |
| ------------- | ------------------------------------------------------------------------ |
| `id`          | UUID，由你生成。回执用它和数组下标定位被拒绝的记录                       |
| `kind`        | `http_exchange` 或 `http_declaration`                                    |
| `version`     | 当前两种记录都只有版本 `1`                                               |
| `observed_at` | 带时区的 RFC 3339 时间，例如 `2026-09-24T08:00:00Z`                      |
| `context`     | 可选，只有调用记录可以带。浏览器页面地址、标题、交互序号等，服务端只保存 |
| `payload`     | 记录内容                                                                 |

### 调用记录

`http_exchange` 是“我确实看到这次请求发生过”。`request` 必填，包含大写的 `method`、带查询参数的完整 `url` 和 `body` 状态。请求/响应 Header 能采到时也应保留；没有采集到响应就省略 `response`，不要补一个虚构的成功响应。

Header 用有序的名称、值对保存，允许同名多项。`headers.state` 有三个取值：`complete` 表示采集到完整 Header，`partial` 表示只看到一部分，`truncated` 表示超限截断。浏览器页面脚本看不到的 Cookie 等内容不能凭空补上，也不能因此声称已拿到最终网络请求的全部 Header。

地址过长被截断时，把 `url_truncated` 设为 `true`。

### 接口声明

`http_declaration` 是“文档里声明这个接口应该长这样”，通常来自 Swagger/OpenAPI。它不是一次真实调用。`method` 和 `path` 必填，路径参数写成 `{name}`，路径中不能带查询参数。

```json
{
  "batch_id": "3f8a1c6e-2b4d-4e7f-9a0c-5d6e7f8a9b0c",
  "platform": "swagger-sync",
  "target": {
    "project_id": "5b0f6a52-1c2d-4c8e-9f35-2a1d7c9e4b10",
    "source_url": "https://shop.example.com/v3/api-docs"
  },
  "records": [
    {
      "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      "kind": "http_declaration",
      "version": 1,
      "observed_at": "2026-09-24T10:00:00Z",
      "payload": {
        "method": "GET",
        "path": "/api/orders/{orderId}",
        "summary": "查询订单",
        "tags": ["订单"],
        "request": {
          "path_params": { "orderId": { "required": true, "schema": { "type": "integer" } } }
        },
        "responses": {
          "200": { "media_type": "application/json", "schema": { "type": "object" } }
        }
      }
    }
  ]
}
```

`request` 可以包含 `path_params`、`query`、`headers` 和 `body`，`responses` 以状态码、`4XX` 这样的范围或 `default` 为键。声明中的 schema 必须已经展开所有 `$ref`。只有结构、没有示例和响应的声明同样合法。

## 内容状态

`body.state` 回答的是“这次到底拿到了多少正文”，请求体和响应体都需要如实说明。有没有请求体不能根据 GET、POST 等方法推断。

| `state`      | 含义                   | 需要的字段                                                                                           |
| ------------ | ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `full`       | 完整内容               | `encoding`（`utf8` 或 `base64`）和 `content`，可选 `media_type`、`bytes`                             |
| `truncated`  | 只有开头一部分         | 同上，`bytes` 填截断前的原始大小                                                                     |
| `partial`    | 只拿到了局部资料或摘要 | `encoding`、`content`，可选 `media_type`、`note`；例如表单文字及文件名称、类型、大小，不包含文件字节 |
| `unreadable` | 有内容，但读不到       | 可选 `media_type`，原因写在 `note`，例如文件上传或二进制流                                           |
| `none`       | 确实没有内容           | 不能带其他字段                                                                                       |

例如：确实未发送正文用 `none`；完整的空 JSON 对象用 `full`，其中 `content` 为字符串 `"{}"`。两者不是一回事。文件上传只拿到文字和文件信息时用 `partial`，不要写成完整的原始 multipart 或文件内容。

`full` 只说明这一次捕获完整，不代表某字段在所有调用中永远不存在。`truncated` 和 `partial` 只能补充已看到的结构，不能据此认定未看到的字段已经消失。`truncated.bytes` 只在知道原始大小时填写，不要把截断后的长度冒充原始长度。

## 校验一个批次

<!-- collect-workbench -->

这里使用与后端一致的 collect 1.1.0 格式规范，检查 JSON 写法、字段类型和大小。示例均为虚构数据，不是真实接口调用结果。

项目和环境是否存在只有服务端知道，这里不做检查。

## 回执

回执相当于“签收单”：`accepted` 是接收数量，`rejected` 是没能接收的具体记录。HTTP 200 也可能同时包含接收成功和被拒绝的记录。

```json
{
  "batch_id": "0b7a3c3e-5c55-4d52-9a57-7b2f3f0e4a11",
  "accepted": 1,
  "rejected": [
    {
      "index": 1,
      "id": "6e2a1d3f-9b8c-4d4e-8f2a-1b3c4d5e6f70",
      "reason": "RECORD_TOO_LARGE",
      "message": "record exceeds 4 MiB"
    }
  ]
}
```

先核对回执的 `batch_id`，再用 `index`（从 0 开始）和 `id` 对应原批次中的记录。只有确认接收的记录才可以移除本地待发送副本；被拒绝的记录应保留问题原因，修正后用新批次提交，不要反复原样重发，也不要重发已经接收的那部分。

| `reason`              | 含义                       |
| --------------------- | -------------------------- |
| `INVALID_RECORD`      | 记录不符合格式规范         |
| `UNSUPPORTED_KIND`    | 服务端不支持这种 `kind`    |
| `UNSUPPORTED_VERSION` | 服务端不支持这个 `version` |
| `RECORD_TOO_LARGE`    | 单条记录序列化后超过 4 MiB |

## 错误与重试

整批被拒绝时，接口返回 4xx 或 5xx，响应体只有一个错误对象，`message` 可能省略：

```json
{ "error": { "code": "UNKNOWN_PROJECT", "message": "project does not exist" } }
```

记住两条就够了：**临时故障保留原批次重试；数据需要修改时，修正后生成新批次。**

| HTTP | `code`                | 原因                                                               | 下一步                                            |
| ---- | --------------------- | ------------------------------------------------------------------ | ------------------------------------------------- |
| 400  | `INVALID_BATCH`       | 批次外层不合法：`batch_id`、`platform`、`target` 或 `records` 数组 | 修正后用新的 `batch_id` 提交                      |
| 413  | `BATCH_TOO_LARGE`     | 请求体超过 8 MiB                                                   | 拆成更小的批次，每批用新的 `batch_id`             |
| 404  | `UNKNOWN_PROJECT`     | 项目不存在                                                         | 重新选择项目，不要重发                            |
| 404  | `UNKNOWN_ENVIRONMENT` | 环境 ID 不属于该项目                                               | 重新选择环境，不要重发                            |
| 409  | `BATCH_ID_REUSED`     | 同一个 `batch_id` 提交了不同的内容                                 | 这是提交方的缺陷：换一个 `batch_id`               |
| 429  | `RATE_LIMITED`        | 这个 `platform` 提交过快                                           | 等待 `Retry-After` 秒后，用同一个 `batch_id` 重发 |
| 503  | `UNAVAILABLE`         | 服务暂时不可用                                                     | 退避后用同一个 `batch_id` 重发                    |

可以重试的情况只会以整批的 429 或 503 出现，不会逐条出现在回执里。

服务端在 7 天内记得处理过的批次。网络中断、超时或 503 之后，用同一个 `batch_id` 和同样的内容重发是安全的：已经处理过的批次会直接返回第一次的回执，记录不会重复计数。

## 限制

| 项目               | 上限              |
| ------------------ | ----------------- |
| 每批记录数         | 1 到 50 条        |
| 请求体             | 8 MiB             |
| 单条记录           | 4 MiB（序列化后） |
| 批次幂等窗口       | 7 天              |
| 每组请求头或响应头 | 256 对            |

超过上限的批次整批返回 413；单条超限的记录出现在回执的 `rejected` 里，同批其他记录照常接收。

## 合同文件

接入资料包定义了“哪些字段可以写、如何判断回执和错误”，用于代码里的自动校验。规范名称为 `collect`，当前版本 **1.1.0**，使用 JSON Schema（draft 2020-12）。1.1.0 已支持正文的 `partial` 状态，包内包含：

| 文件                  | 内容                                     |
| --------------------- | ---------------------------------------- |
| `batch.schema.json`   | 请求体                                   |
| `receipt.schema.json` | HTTP 200 的回执                          |
| `error.schema.json`   | 4xx 和 5xx 的错误响应                    |
| `fixtures/`           | 必须通过和必须失败的示例，文件名说明用途 |
| `manifest.json`       | 以上每个文件的 SHA-256                   |

自建工具接入时使用整份资料包，并按 `manifest.json` 核对文件是否完整；本页的校验工具也使用这份规范。普通 Fetcher 用户不需要手动处理这些文件。不兼容的变更会使用新的版本目录。

浏览器场景可以直接使用 [NexoFolio Fetcher](/docs/fetcher)。让 Agent 读取整理后的接口知识，请参阅 [MCP 与 NexoFolio](/docs/mcp)。
