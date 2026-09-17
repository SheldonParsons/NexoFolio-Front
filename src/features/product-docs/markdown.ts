import MarkdownIt from 'markdown-it'

export interface ArticleHeading {
  id: string
  title: string
  level: number
}
const markdown = new MarkdownIt({ html: false, linkify: true, typographer: false })
markdown.renderer.rules.table_open = () => '<div class="pd-table-wrap"><table>'
markdown.renderer.rules.table_close = () => '</table></div>'

export function renderArticle(body: string, prefix = '') {
  const tokens = markdown.parse(body, {})
  const headings: ArticleHeading[] = []
  const used = new Map<string, number>()
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!
    if (token.type === 'heading_open') {
      const title = tokens[index + 1]?.content ?? ''
      const slug =
        `${prefix}-${title}`
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, '-')
          .replace(/^-|-$/g, '') || 'section'
      const count = used.get(slug) ?? 0
      used.set(slug, count + 1)
      const id = count ? `${slug}-${count + 1}` : slug
      token.attrSet('id', id)
      headings.push({ id, title, level: Number(token.tag.slice(1)) })
    }
    for (const child of token.children ?? []) {
      if (child.type !== 'link_open') continue
      const href = String(child.attrGet('href') ?? '')
      if (/^\/(docs|changelog)(?:[/?#]|$)/.test(href)) child.attrSet('href', `${base}${href}`)
      if (/^https?:\/\//.test(href)) {
        child.attrSet('target', '_blank')
        child.attrSet('rel', 'noopener noreferrer')
      }
    }
  }
  return { html: markdown.renderer.render(tokens, markdown.options, {}), headings }
}
