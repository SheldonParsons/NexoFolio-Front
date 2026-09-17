# 文档页深色主题污染修复

## 根因与修改

KnowledgeFlow.vue 和 PhilosophyArticle.vue 的 scoped CSS 使用了 `:global(:root[data-theme=dark])` 后接后代选择器。当前 Vue 编译器将后代部分丢弃，实际输出两条纯根节点规则：filter: invert(0.85) 和 opacity: 0.9。文档组件卸载后样式仍驻留，因此污染后续项目页。

仅将这两条规则改成普通 `:root[data-theme=dark]` 祖先选择器，由 scoped 编译器给目标图片附加 scope 属性。保留连接图案的局部反色和插图的局部透明度。

构建另发现 markdown.ts 的 href 属性类型为 string | number，与正则参数类型不匹配；添加 String(...) 转换，保持已有正则的字符串匹配行为。

## 验证

- 实际 Vue 编译结果已复现两个根节点规则。
- 新增 tests/scoped-theme.test.ts，遍历组件 scoped 样式并检查编译结果不会给 html/body/:root/#app 施加全页滤镜或透明度。修复前准确报告两个问题；修复后通过。
- pnpm build（含类型检查）通过。
- 浏览器实际操作文档页主题按钮：修复前 dark 的根节点 filter=invert(0.85)、opacity=0.9；修复后 dark 为 filter=none、opacity=1、背景rgb(0,0,0)。插图 opacity=0.9、filter=none，连接图案保留 invert(0.85)。
- 浅色文档页：根节点 none/1、背景rgb(255,255,255)，插图opacity=1，连接图案filter=none。
- 同一 SPA 会话从深色文档页点击进入项目页：文档样式仍驻留，根节点仍为 none/1，项目背景rgb(0,0,0)，标题rgb(245,245,245)。再切浅色并后退到文档页，根节点保持none/1和白色背景。
- 文档页直接使用真实页面；项目页跨路由检查仅使用合成认证与空项目列表，不使用真实账户，也不是后端业务验收。临时入口已删除、标签页已关闭，并恢复初始浅色偏好。

未提交代码，未改动后端服务。
