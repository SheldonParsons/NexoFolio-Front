## 什么时候使用

NexoFolio Fetcher 在浏览器里采集接口调用。如果资料来自别处，例如自建的抓包工具、网关日志、测试脚本或 Swagger 同步任务，可以直接调用收集接口，把它们提交到同一个项目里。

收集接口只做一件事：按批接收记录，确认每一条的去向。整理成接口文档、合并路径差异、识别第三方请求，都由服务端在接收之后完成，提交方不需要预先处理。

## 快速开始

把一批记录作为 JSON 发送到收集接口。不需要登录或令牌，但必须用 `platform` 说明数据来自哪个工具。

```bash
curl -X POST "$NEXOFOLIO_URL/v1/collect/batches" \
  -H "Content-Type: application/json" \
  --data @batch.json
```

下面的 `batch.json` 提交了一次实际发生的调用。环境按名称填写，不存在时会自动创建。

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
          "body": { "state": "none" }
        },
        "response": {
          "status": 200,
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

成功时返回 HTTP 200 和一张回执。回执里没有列出的记录都已被接收，可以删除本地副本。

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

`platform` 只用于标记来源、统计和限流，不代表身份，也不影响记录归属。批次和记录都不允许出现合同之外的字段。

## 归属

`target` 决定这一批记录进入哪个项目、哪个环境。归属由提交方决定，服务端只校验，不根据域名猜测。

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

`http_exchange` 表示一次实际发生的调用。`request` 必填，包含大写的 `method`、带查询参数的绝对地址 `url` 和 `body`；`headers` 可选。没有采集到响应时省略 `response`；采集到时必须带 `status` 和 `body`。

请求头写成有序的名称、值对，允许重复。`headers.state` 说明你看到的是否完整：`complete` 表示全部请求头，`partial` 表示只能看到一部分（例如浏览器页面内看不到 Cookie），`truncated` 表示超过上限被截断。

地址过长被截断时，把 `url_truncated` 设为 `true`。

### 接口声明

`http_declaration` 表示一份声明出来的接口结构，通常来自 Swagger、OpenAPI 或手工录入。`method` 和 `path` 必填，路径参数写成 `{name}`，路径中不能带查询参数。

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

请求体和响应体都用 `body.state` 说明你实际拿到了什么。拿不到的内容保留为对应状态，不要补造。

| `state`      | 含义             | 需要的字段                                                               |
| ------------ | ---------------- | ------------------------------------------------------------------------ |
| `full`       | 完整内容         | `encoding`（`utf8` 或 `base64`）和 `content`，可选 `media_type`、`bytes` |
| `truncated`  | 只有开头一部分   | 同上，`bytes` 填截断前的原始大小                                         |
| `unreadable` | 有内容，但读不到 | 可选 `media_type`，原因写在 `note`，例如文件上传或二进制流               |
| `none`       | 确实没有内容     | 不能带其他字段                                                           |

只有 `full` 能证明某个字段不存在。`truncated` 的内容只用来补充结构，不会让已知字段被判定为消失。

## 校验一个批次

<!-- collect-workbench -->

这里使用的就是服务端的合同文件，大小上限也按同样的规则计算。示例和常见错误都来自合同自带的测试样例，其中的地址和 ID 都是虚构的。

项目和环境是否存在只有服务端知道，这里不做检查。

## 回执

HTTP 200 表示批次已经处理完成，回执说明每条记录的去向。

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

`accepted` 是被接收的记录数。`rejected` 里的每一项用 `index`（从 0 开始）和 `id` 指向原批次中的记录，这些记录重发也不会成功，应当修正或丢弃。

| `reason`              | 含义                       |
| --------------------- | -------------------------- |
| `INVALID_RECORD`      | 记录不符合合同             |
| `UNSUPPORTED_KIND`    | 服务端不支持这种 `kind`    |
| `UNSUPPORTED_VERSION` | 服务端不支持这个 `version` |
| `RECORD_TOO_LARGE`    | 单条记录序列化后超过 4 MiB |

## 错误与重试

整批被拒绝时，接口返回 4xx 或 5xx，响应体只有一个错误对象，`message` 可能省略：

```json
{ "error": { "code": "UNKNOWN_PROJECT", "message": "project does not exist" } }
```

是否重发、用哪个 `batch_id` 重发，取决于错误码。

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

收集接口的请求、回执和错误结构以 JSON Schema（draft 2020-12）形式公开，合同名为 `collect`，当前版本 1.0.0。合同目录包含：

| 文件                  | 内容                                     |
| --------------------- | ---------------------------------------- |
| `batch.schema.json`   | 请求体                                   |
| `receipt.schema.json` | HTTP 200 的回执                          |
| `error.schema.json`   | 4xx 和 5xx 的错误响应                    |
| `fixtures/`           | 必须通过和必须失败的示例，文件名说明用途 |
| `manifest.json`       | 以上每个文件的 SHA-256                   |

接入时建议整份复制合同目录，并按 `manifest.json` 校验哈希；本页的校验工具就是这样使用它的。不兼容的变更会发布为新的版本目录。

浏览器场景可以直接使用 [NexoFolio Fetcher](/docs/fetcher)。让 Agent 读取整理后的接口知识，请参阅 [MCP 与 NexoFolio](/docs/mcp)。
