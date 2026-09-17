# NexoFolio 导航品牌插图 v1

生成日期：2026-09-15。

- 图片：`public/brand/nexofolio-nav-card-v1.png`。
- 用途：导航下拉菜单的竖版品牌卡片，比例 3:4。
- 工具：内置 image_gen，经 imagegen 技能生成；未使用 CLI/API 回退。
- 身份依据：`public/nexofolio/static-logo.png`；对照 `public/brand/nexofolio-icon.svg`。
- 用户参考：Reka UI 深色品牌卡片及导航下拉菜单截图。
- 已查看产物：保留原 logo 的双片折叠轮廓；石墨银色材质，背后为暗色玻璃文档卡片；品牌名与中文文案正确。
- 图片含文字，当前提供完整视觉素材。尚未接入导航组件。原 logo 文件保持不变。

## 生成提示词

```text
Use case: stylized-concept
Asset type: finished portrait brand illustration card for the left feature area of a website navigation dropdown, NexoFolio.
Input images: Image 1 is the actual NexoFolio logo, the sole identity reference; retain its exact distinctive folded two-part N silhouette and cutouts, do not replace it with a generic letter N. Image 2 is composition/style reference: restrained dark Reka UI brand card with whitespace, logo above bottom-left typography. Image 3 shows usage context only: dropdown menu. Generate ONLY the card art, not the surrounding menu or website.
Canvas: portrait aspect ratio 3:4, ideally 1200x1600. Full-bleed opaque near-black warm charcoal background #191918. Straight image edges, no surrounding white margin, no rounded corner mask (website will clip corners).
Composition: premium minimal editorial brand card, generous calm negative space at top (roughly top 20%). The authentic NexoFolio mark appears around middle-left, occupying about 42% of canvas width and 30% of canvas height, front-facing with very slight physical depth. It must preserve the distinctive logo structure. Visually enrich the logo with softly beveled graphite and smoked silver metal, satin faces, bright restrained pearly edge lighting. Subtle cool silver reflections, no rainbow, no neon.
Supporting details: behind and to the right of the mark, just two or three thin translucent smoky glass sheets reminiscent of interface documentation cards, softly offset in depth. Tiny abstract rows and two understated connecting dots hint at structured API knowledge, no legible code or additional icons. Details stay dim and subordinate, no busy web of lines, no orbit rings, no futuristic HUD. Soft diffuse contact shadows and an extremely subtle local gray glow establish depth. Overall refined and legible at 280-380px wide.
Typography: at lower left with 12% left margin, clear large white sans-serif exact text "NexoFolio". Under it, a smaller light-gray Chinese sentence in a clean modern sans-serif, set on two lines exactly:
"每个接口，"
"都值得被理解。"
Keep typography crisp with generous line height. Bottom padding about 11%. Do not add other words, logos, captions, buttons, borders, watermarks, gradients in rainbow colors, or surrounding UI.
Style: premium developer-tool brand illustration, quiet and precise, modest 3D material richness inspired by reference card; not a large dramatic hero scene.
```
