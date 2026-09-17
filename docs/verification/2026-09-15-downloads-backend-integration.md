# 下载版本后端接口联调

日期：2026-09-15。

- 前端仅调用 `/api/v1/downloads?desktop_channel=internal|public`。移除 OSS 清单地址配置、浏览器 JSON/YAML 获取和 yaml 直接依赖。
- 后端契约位于后端仓库 `docs/contracts/0010-downloads.md`。缓存由后端统一负责，前端仅在途去重和保留各渠道展示状态；手动检查不附加未知查询参数。
- 前端 49 项相关测试（15 下载、13 API 客户端、21 项目刷新）、类型检查、生产构建通过。
- 临时同源代理 5187 将版本接口转发到后端任务提供的 18981。页面认证/目录为合成 fixture，下载版本信息使用真实后端与真实 OSS。
- 实际浏览器看到 Fetcher v0.1.0 开发版、AsyncTest v3.3.10；默认内部版三平台安装包正确，切换公网版后三平台全部替换，重新检查只增加一次同源后端请求。
- 浏览器版本请求为 internal、public、public 三次 `/api/v1/downloads`，没有 OSS JSON/YAML 请求。项目转场仍约 2002ms，没有被版本读取阻塞。
- 响应保存在 `downloads-backend-20260915/internal.json` 和 `public.json`；浏览器观察记录在同目录 `browser-observation.json`。

共享 18080 尚未加载新路由，主后端要求真实插件录制期间不重启。以上是隔离联调通过，不是共享服务或部署完成声明。已通知主后端在其当前验证结束后协调加载；隔离端口的生命周期由后端下载任务负责。临时前端代理与浏览器已清理。
