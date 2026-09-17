# 持续知识维护：前端接入

代码位于 `src/features/maintenance`，当前合同为 `maintenance/1.5.0`、`capture/1.2.0`、`catalog-preview/1.4.0`、`documents/1.4.0`，完整包逐文件校验 SHA-256。入口 `/projects/:projectId/maintenance`，正式目录与接口文档提供“重构 / 知识维护”链接；正式目录成员详情与接口文档详情均显示独立语义资料区。后端接口部署前会明确报服务错误，不以示例数据冒充。现有目录专用候选与发布/回退保持兼容。

## 组件边界

| 组件 / 模块                                        | 职责                                                                                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `RebuildControl` / `useRebuildRequest`             | 仅用户点击发起重构，不选择全量/局部；读页面与切项目不会创建任务。不确定结果保留同一个 requestKey，只有用户显式重试才再次调用 start。 |
| `TaskProgressPanel`                                | 快照范围、全量字段审阅覆盖、分片、回读、模型策略与原因、缺失/失败状态；未知计数显示未知，不默认为零。                                |
| `CandidateChangesPanel`                            | 目录与语义改动统一展示，提供前后值、依据、原因、证据和 stale 标记；组件不负责发布。                                                  |
| `SemanticFieldsPanel`                              | 独立语义资料，区分观察/推断/待复核；未传、显式 null、false、0、空字符串分别展示；已见取值不标为完整枚举。                            |
| `EvidenceLinks` / `EvidenceViewer` / `useEvidence` | 显式点击后读取项目权限内的原文或截图；原文仅 `pre` 文本，截图仅 Blob URL；关闭、更换目标或卸载释放 URL 并取消请求。                  |
| `useMaintenanceWorkspace`                          | 只读任务、候选、环境内语义资料；独立请求取消与目标绑定，旧响应不能覆盖新选择。                                                       |

`models.ts` 是页面展示模型，`ports.ts` 是应用内部依赖注入接口；都不是服务器契约。`contract.ts` 校验固定 Schema，`source.ts` 提供接口绑定，`mapping.ts` 映射任务、候选和语义。枚举完整性、审阅覆盖确认与 stale 由服务给出，不从有限样例、计数或模型文字推导。候选尚未读取当前修订时标为“尚未核对”。

## 已接合同与限制

- 显式 POST `maintenance-runs {request_id}` 返回任务，GET 集合为不含候选正文的摘要分页，GET 详情含候选与聚合覆盖。创建、读取端口分离；pending/running 任务在页面可见时只读刷新，不二次 start。
- 聚合完成分片数、覆盖计数、read_count/model_calls/phase 与真实检查点分开展示。检查点分页读取阶段、摘要、原始 data、references 与 review 中的 unit_id/field_id、disposition、note；未提供的字段不补造。summary 引用按 checkpoint ID 分页定位读取。
- 显式读取快照才展示快照基线；“读取当前资料作比较”读取带 generation 的全部当前目录归属和相关环境语义，语义请求最多 3 个并发，拒绝混合不同知识代次。界面区分快照基线与当前基线，未读取基线不当作不存在。路径关系的来源/目标修订一起核对。
- POST `maintenance-runs/{run}/publish` 与 `knowledge/restore` 沿用共享 generation 和原请求重试，后者显式 version_id:null 恢复初始目录及语义。成功后 GET 版本与任务状态；组件不自动发布，旧目录专用操作不被替代。
- `InterfaceKnowledge` 的 annotations.stale 是最终判定，FieldRef 保留 interface/environment/revision/location/path；枚举 present-null、omitted、unknown 三者分开。完整枚举声明、观察范围与 verification 分开显示。
- image ID 为 asset_id，按项目 GET assets 读取原始 PNG/JPEG/WebP，最大 8MiB，Bearer+no-store+禁止跳转。field/directory 经来源任务快照定位；fact 直接读取 `/evidence/{id}`，fact.samples 可继续读取 capture-observations，明确 payload_available=false。summary 经所属任务的 checkpoints 定位。证据 ID 不是外部 URL；原文只按文本渲染，关闭释放 Blob URL。
- 正式目录和目录版本以 source_run_id/source_task_id 区分来源，分别跳到 maintenance?run= 和 catalog-preview?task= 并选中对应任务。原始文档 raw_record:null 显示临时原文过期，保留观测元数据与差异入口，不显示字面量 null。

页面组合时按 API 服务、登录用户、项目隔离重构请求存储；以这些身份为组件 key，关闭证据弹窗时必须清空 reference。不要让候选、证据或重构请求穿越用户/项目切换。授权在后端读取和变更时复核，界面显示不是权限证明。

页面不开始或结束录制，不在挂载、刷新、轮询、进度完成时启动重构、发布或回退。现有正式目录、固定待分类、旧候选和旧发布保持可用。

maintenance 1.4.0 补充：`interface` 证据引用按来源任务的 `snapshot.interfaces[].interface_id` 定位，展示完整接口快照及其各环境定义，并附来源 run/snapshot ID；不读取实时接口版本。此类引用用于目录和描述的依据，未放宽参数关系和枚举对相应字段/事实证据的要求。本次仅同步合同与补充证据适配，未重新运行验证。

## 当前验证

既有 12 项组件/状态测试、8 项合同适配测试和 5 项合同升级测试，随项目测试共 111 项通过，覆盖真实生成 Schema、幂等 start/统一发布/显式 null 回退、目标绑定、原始 payload 缺失、服务端 stale、未知/未传/null、快照与未知基线、检查点/单条 fact、新旧来源与过期原文。

类型检查与生产构建通过，5173 新路由返回 HTTP 200；不等于真实维护 API 或页面业务验收。未使用 Ego Lite、未真实触发模型、录制或发布，未修改后端/插件、未提交推送。后端部署与集成验收由后端任务继续。
