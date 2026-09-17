# 理念文档的编辑视觉

本轮范围：移除通用 Header 下的第二行栏目导航，将文档搜索移到左侧目录顶部；更新日志的搜索放在其标题旁。保留原有 Header 和下载组件。

理念页单独使用 `PhilosophyArticle.vue`，其他文章继续使用普通 Markdown 渲染。标题下放一幅原创抽象插画，第一节正文后用 `KnowledgeFlow.vue` 解释“真实使用 → 整理与审阅 → 持续积累”。流程以 SVG/CSS 的线条行进、轻微漂浮和悬停反馈呈现，不代表真实后台进度。离屏、后台及减少动态效果时暂停或停用动画。

用户提供的编辑插画参考：[Anthropic 公告](https://www.anthropic.com/news/enterprise-frontier-safeguards)。借鉴插画作为文章视觉停顿的作用，不复制其素材。参考页面的 SVG 未通过网页工具显示，因此不宣称逐项复刻该插画的造型或材质。

## 插画资产

- 项目路径：`public/illustrations/philosophy-traces.png`
- 使用方式：静态 PNG，透明背景，跟随 BASE_URL 加载；未做图片后处理。
- 生成方式：内置 image_gen。
- 来源原件：`/Users/sheldon/.codex/generated_images/01a09ec4-d8fe-7693-bfdb-942555f3a319/exec-6953053e-f58f-4ea2-9242-0a837a33141d.png`
- 生成意图：以片段、折面和层叠纸页隐喻知识积累，保持文字与插画各自的职责。

生成提示词：

> Create one premium abstract editorial illustration asset for NexoFolio, an API knowledge product. Wide composition about 2.4:1, no typography, no text, no labels, no logo, no arrows, no user-interface mockup. Concept: small independent traces of real activity gradually gather into connected, layered knowledge. At the left, a carefully composed sparse constellation of tiny graphite slivers, delicate wire curves and fine floating paper fragments; through the middle, the traces meet a subtly prismatic, transparent folded surface; at the right, an elegant sculptural stack of thin semi-transparent vellum and dark graphite sheets, held in a precise spatial relationship. Sophisticated art direction, museum editorial illustration, exceptional fine material detail, restrained mathematical geometry, gentle ambient occlusion, satin charcoal edges, delicate glass highlights, mostly monochrome with only tiny desaturated iridescent fringes. Orthographic-ish view, a little depth but NOT an app screenshot or tech diagram. Main forms lie horizontally centered with generous negative space and breathing room; nothing cropped by the frame. Transparent background with genuine alpha, isolated objects, no white rectangular canvas plate, no ground horizon. Designed to sit inside a minimalist pure-white or pure-black technical documentation page. No glowing brain, no robot, no neon, no generic stock AI sphere, no cartoon people, no watermarks. One cohesive, quietly beautiful composition rather than a collage.

按用户要求未运行测试、构建、浏览器或页面验证；上述为实施说明，不是验收结果。
