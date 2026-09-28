<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

type Field = { key: string; value: string; kind: 'number' | 'string' | 'empty'; note: string }
type Clue = {
  field: number
  kind: 'badge' | 'heading' | 'person' | 'call' | 'note' | 'text'
  text: string
  sub?: string
  // Resting place while scattered, as a fraction of the stage.
  home: [number, number]
}

const fields: Field[] = [
  { key: 'id', value: '1024', kind: 'number', note: '资料编号，与路径里的 id 一致。' },
  { key: 'title', value: '"Q3 渠道返利政策"', kind: 'string', note: '资料标题，详情页的主标题。' },
  {
    key: 'status',
    value: '3',
    kind: 'number',
    note: '资料状态。3 表示已沉淀：整理完成，可以被引用。',
  },
  { key: 'owner_id', value: '88', kind: 'number', note: '负责人编号，对应用户「陈蔚」。' },
  { key: 'tags', value: '[]', kind: 'empty', note: '标签。14 次调用都为空，类型待定。' },
  { key: 'updated_at', value: '1727148000000', kind: 'number', note: '最后更新时间，毫秒时间戳。' },
]
const clues: Clue[] = [
  { field: 0, kind: 'call', text: 'GET', sub: '/api/materials/1024', home: [0.62, 0.06] },
  { field: 1, kind: 'heading', text: 'Q3 渠道返利政策', home: [0.8, 0.3] },
  { field: 2, kind: 'badge', text: '已沉淀', home: [0.93, 0.08] },
  { field: 2, kind: 'call', text: 'GET', sub: '/api/materials?status=3', home: [0.56, 0.5] },
  { field: 2, kind: 'note', text: '“3 代表整理完成，可以引用。”', home: [0.84, 0.72] },
  { field: 3, kind: 'person', text: '陈蔚', sub: '负责人', home: [0.66, 0.9] },
  { field: 3, kind: 'call', text: 'GET', sub: '/api/users/88', home: [0.95, 0.48] },
  { field: 4, kind: 'call', text: 'tags', sub: '[]  ×14', home: [0.47, 0.96] },
  { field: 5, kind: 'text', text: '更新于 2024-09-24 11:20', home: [0.68, 0.24] },
]
const phases = ['收集', '连接', '理解']
// Scroll share of each field's connect-and-annotate window, in row order.
const windows = (() => {
  const lengths = [0.13, 0.13, 0.19, 0.14, 0.12, 0.12]
  let start = 0.32
  return lengths.map((length) => {
    const window = [start, start + length] as const
    start += length - 0.035
    return window
  })
})()

const root = ref<HTMLElement | null>(null)
const track = ref<HTMLElement | null>(null)
const pin = ref<HTMLElement | null>(null)
const stage = ref<HTMLElement | null>(null)
const bar = ref<HTMLElement | null>(null)
const summary = ref<HTMLElement | null>(null)
const phase = ref(0)
const done = ref(false)
const peek = ref<number | null>(null)
const reduced = ref(false)
const caption = computed(() => {
  if (done.value)
    return peek.value === null ? '点任一字段，看它的含义从哪里来。' : '再点一次，收起依据。'
  if (phase.value === 0) return '收集来的信息，散落各处。'
  return '每个字段，都在找它的依据。'
})

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const span = (value: number, from: number, to: number) => clamp((value - from) / (to - from))
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const mix = (from: number, to: number, t: number) => from + (to - from) * t
function random(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
}

type Point = { x: number; y: number }
type Token = {
  el: HTMLElement
  line: number
  order: number
  dx: number
  dy: number
  turn: number
  size: number
  alpha: number
}
type ClueBox = {
  el: HTMLElement
  path: SVGPathElement
  w: number
  h: number
  home: Point
  pool: Point
  dock: Point
  stack: number
  // Narrow screens: distance below the note where this clue hangs.
  lift: number
}
type Row = {
  el: HTMLElement
  note: HTMLElement
  leader: HTMLElement
  anchor: Point
  text: number
  room: number
}
let tokens: Token[] = []
let compact = false
let boxes: ClueBox[] = []
let rows: Row[] = []
let scroller: HTMLElement | Window = window
let target = 0
let progress = 0
const peekAmount = fields.map(() => 0)
let frame = 0
let resizeObserver: ResizeObserver | undefined

function offset(element: HTMLElement): Point {
  let x = 0,
    y = 0,
    node: HTMLElement | null = element
  while (node && node !== stage.value) {
    x += node.offsetLeft
    y += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  return { x, y }
}

function measure() {
  const host = stage.value
  if (!host) return
  const width = host.clientWidth
  const next = random(20260924)
  const sizes = [...host.querySelectorAll<HTMLElement>('.clue')].map((el) => ({
    w: el.offsetWidth,
    h: el.offsetHeight,
  }))
  // Waiting clues settle into a pool under the document, wrapping like words.
  const closing = [...host.querySelectorAll<HTMLElement>('.ac-row--brace')].at(-1)!
  const poolTop = closing.offsetTop + closing.offsetHeight + 34
  const pool: Point[] = []
  let cursorX = 0,
    cursorY = 0
  sizes.forEach((size) => {
    if (cursorX && cursorX + size.w > width) {
      cursorX = 0
      cursorY += 46
    }
    pool.push({ x: cursorX, y: poolTop + cursorY + (34 - size.h) / 2 })
    cursorX += size.w + 22
  })
  host.style.paddingBottom = `${cursorY + 34 + 58}px`
  if (summary.value) summary.value.style.top = `${poolTop}px`
  const height = host.clientHeight
  rows = [...host.querySelectorAll<HTMLElement>('.ac-field')].map((el) => {
    const last = el.querySelector<HTMLElement>('.tk:last-child')!
    const end = offset(last)
    return {
      el,
      note: el.querySelector<HTMLElement>('.ac-note')!,
      leader: el.querySelector<HTMLElement>('.ac-leader')!,
      anchor: { x: end.x + last.offsetWidth + 6, y: end.y + last.offsetHeight / 2 },
      text: el.querySelector<HTMLElement>('.ac-note-text')!.offsetHeight,
      room: 0,
    }
  })
  tokens = [...host.querySelectorAll<HTMLElement>('.tk')].map((el) => {
    const at = offset(el)
    const x = next() * Math.max(0, width * 0.72 - el.offsetWidth)
    const y = next() * (height - 30)
    return {
      el,
      line: Number(el.dataset.line),
      order: Number(el.dataset.order),
      dx: x - at.x,
      dy: y - at.y,
      turn: (next() - 0.5) * 34,
      size: 0.8 + next() * 0.5,
      alpha: 0.3 + next() * 0.45,
    }
  })
  const paths = [...host.querySelectorAll<SVGPathElement>('.ac-lines path')]
  const seen = fields.map(() => 0)
  const totals = fields.map((_, index) => clues.filter((clue) => clue.field === index).length)
  compact = rows[0]!.leader.offsetWidth === 0
  const below = fields.map(() => 6)
  boxes = [...host.querySelectorAll<HTMLElement>('.clue')].map((el, index) => {
    const clue = clues[index]!
    const { w, h } = sizes[index]!
    const note = offset(rows[clue.field]!.note)
    const stack = seen[clue.field]!++
    const spread = (stack - (totals[clue.field]! - 1) / 2) * (h + 8)
    const lift = below[clue.field]!
    below[clue.field] = lift + h + 6
    return {
      el,
      path: paths[index]!,
      w,
      h,
      home: {
        x: Math.min(width - w, Math.max(0, clue.home[0] * width - w / 2)),
        y: clue.home[1] * height - h / 2,
      },
      pool: pool[index]!,
      // Wide screens park clues just left of the note; narrow ones use `lift`.
      dock: { x: note.x - 18 - w, y: note.y + 14 - h / 2 + spread },
      stack,
      lift,
    }
  })
  if (compact) rows.forEach((row, index) => (row.room = below[index]! + 2))
  render()
}

// A clue's journey through its field's window: fly to the field, then dissolve.
function clueState(u: number, stack: number) {
  const fly = ease(span(u, stack * 0.07, 0.42))
  const fade = span(u, 0.5, 0.72)
  return { fly, fade, draw: ease(span(u, 0.04 + stack * 0.07, 0.4)), line: 1 - span(u, 0.46, 0.66) }
}

function render() {
  const p = progress
  const host = stage.value
  if (!host) return
  for (const token of tokens) {
    const start = 0.04 + token.line * 0.022 + token.order * 0.009
    const t = ease(span(p, start, start + 0.17))
    const r = 1 - t
    token.el.style.transform = `translate(${token.dx * r}px, ${token.dy * r}px) rotate(${token.turn * r}deg) scale(${mix(token.size, 1, t)})`
    token.el.style.opacity = String(mix(token.alpha, 1, t))
  }
  host.style.setProperty('--built', span(p, 0.1, 0.28).toFixed(3))
  if (summary.value) summary.value.style.opacity = String(span(p, 0.93, 0.99))
  const local = windows.map(([from, to]) => span(p, from, to))
  const focus = Math.max(
    ...local.map((u, index) =>
      Math.max(span(u, 0, 0.12) * (1 - span(u, 0.88, 1)), peekAmount[index]!),
    ),
  )
  rows.forEach((row, index) => {
    const u = local[index]!
    const lit = Math.max(span(u, 0, 0.12) * (1 - span(u, 0.88, 1)), peekAmount[index]!)
    row.el.style.setProperty('--lit', lit.toFixed(3))
    row.el.style.setProperty('--dim', (1 - 0.72 * Math.max(0, focus - lit)).toFixed(3))
    row.note.style.setProperty('--w', span(u, 0.48, 0.96).toFixed(3))
    row.leader.style.transform = `scaleX(${ease(span(u, 0.4, 0.62)) * (1 - peekAmount[index]!)})`
    // Narrow screens open the row so its clues can hang under the note.
    if (compact) {
      const open = Math.max(span(u, 0, 0.1) * (1 - span(u, 0.62, 0.8)), peekAmount[index]!)
      row.note.style.paddingBottom = `${(row.room * ease(open)).toFixed(1)}px`
    } else row.note.style.paddingBottom = ''
  })
  boxes.forEach((box, index) => {
    const field = clues[index]!.field
    const settled = clueState(local[field]!, box.stack)
    const open = clueState(0.42, box.stack)
    const k = peekAmount[field]!
    const fly = mix(settled.fly, open.fly, k)
    const fade = mix(settled.fade, open.fade, k)
    const draw = mix(settled.draw, open.draw, k)
    const line = mix(settled.line, open.line, k)
    // Loose clues drift with the scroll, then sink into the pool to wait.
    const gather = ease(span(p, 0.08 + index * 0.014, 0.26 + index * 0.014))
    const drift = -p * 90 * (index % 2 ? 1 : 0.55)
    const waitX = mix(box.home.x, box.pool.x, gather)
    const waitY = mix(box.home.y + drift, box.pool.y, gather)
    const row = rows[field]!
    const note = compact ? offset(row.note) : { x: 0, y: 0 }
    const dock = compact ? { x: note.x + 34, y: note.y + row.text + box.lift } : box.dock
    const x = mix(waitX, dock.x, fly)
    const y = mix(waitY, dock.y, fly)
    box.el.style.transform = `translate(${x}px, ${y}px) scale(${1 - 0.14 * fade})`
    box.el.style.opacity = String((0.6 + 0.4 * fly) * (1 - fade))
    box.el.style.filter = fade > 0.01 ? `blur(${fade * 6}px)` : ''
    const to = { x: x - 8, y: y + box.h / 2 }
    if (compact) {
      // A small tree: one trunk under the note, a branch to each clue.
      const trunk = { x: note.x + 20, y: note.y + row.text + 2 }
      const turn = Math.max(trunk.y, to.y - 6)
      box.path.setAttribute(
        'd',
        `M${trunk.x},${trunk.y} V${turn} Q${trunk.x},${to.y} ${trunk.x + 6},${to.y} H${Math.max(trunk.x + 6, to.x)}`,
      )
    } else {
      const from = row.anchor
      const bend = (to.x - from.x) * 0.5
      box.path.setAttribute(
        'd',
        `M${from.x},${from.y} C${from.x + bend},${from.y} ${to.x - bend},${to.y} ${to.x},${to.y}`,
      )
    }
    box.path.style.strokeDashoffset = String(1 - draw)
    box.path.style.opacity = String(draw > 0 ? line * (1 - fade * 0.5) : 0)
  })
  if (bar.value) bar.value.style.transform = `scaleX(${p})`
  const nextPhase = p < 0.26 ? 0 : p < windows[2]![1] ? 1 : 2
  if (phase.value !== nextPhase) phase.value = nextPhase
  const complete = p > 0.975
  if (done.value !== complete) {
    done.value = complete
    if (!complete) peek.value = null
  }
}

function tick() {
  frame = 0
  const smooth = reduced.value ? 1 : 0.14
  progress += (target - progress) * smooth
  if (Math.abs(target - progress) < 0.0004) progress = target
  let moving = progress !== target
  peekAmount.forEach((amount, index) => {
    const goal = peek.value === index ? 1 : 0
    let next = amount + (goal - amount) * (reduced.value ? 1 : 0.16)
    if (Math.abs(goal - next) < 0.002) next = goal
    peekAmount[index] = next
    if (next !== goal) moving = true
  })
  render()
  if (moving) wake()
}
function wake() {
  if (!frame) frame = requestAnimationFrame(tick)
}
function onScroll() {
  if (reduced.value || !track.value || !pin.value) return
  const rect = track.value.getBoundingClientRect()
  const view = scroller instanceof Window ? scroller.innerHeight : scroller.clientHeight
  const top = scroller instanceof Window ? 0 : scroller.getBoundingClientRect().top
  // Pin the stage centered at its own height, so no empty band sits above it
  // before it pins. Narrow screens grow rows while playing; keep those at the top.
  const height = pin.value.offsetHeight
  const pinTop = compact ? 0 : Math.max(0, (view - height) / 2)
  pin.value.style.top = `${pinTop}px`
  // Progress runs exactly while the stage is pinned.
  target = clamp((top + pinTop - rect.top) / Math.max(1, rect.height - height))
  wake()
}
function choose(index: number) {
  if (!done.value) return
  peek.value = peek.value === index ? null : index
  wake()
}

onMounted(() => {
  reduced.value = matchMedia('(prefers-reduced-motion: reduce)').matches
  scroller = root.value?.closest<HTMLElement>('[data-scroll-container]') ?? window
  if (reduced.value) target = progress = 1
  scroller.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  resizeObserver = new ResizeObserver(() => {
    measure()
    onScroll()
  })
  if (stage.value) resizeObserver.observe(stage.value)
  measure()
  onScroll()
  progress = target
  render()
})
onBeforeUnmount(() => {
  scroller.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  resizeObserver?.disconnect()
  cancelAnimationFrame(frame)
})
</script>

<template>
  <div ref="root" class="after-collect" :class="{ 'is-done': done, 'is-static': reduced }">
    <div ref="track" class="ac-track">
      <div ref="pin" class="ac-pin">
        <div class="ac-intro">
          <h2>不同，在收集之后。</h2>
          <p>散落的是信息。<br /><span>连接起来，才开始有了意义。</span></p>
        </div>

        <div class="ac-bar">
          <p class="ac-request"><span>GET</span>/api/materials/1024</p>
          <ol class="ac-phases">
            <li v-for="(name, index) in phases" :key="name" :class="{ 'is-on': phase >= index }">
              {{ name }}
            </li>
          </ol>
          <span class="ac-progress" aria-hidden="true"><i ref="bar" /></span>
        </div>

        <div ref="stage" class="ac-stage">
          <svg class="ac-lines" aria-hidden="true">
            <path v-for="index in clues.length" :key="index" pathLength="1" />
          </svg>

          <div class="ac-row ac-row--brace">
            <span class="ac-ln">1</span
            ><code><span class="tk" data-line="0" data-order="0">{</span></code>
          </div>
          <button
            v-for="(field, index) in fields"
            :key="field.key"
            type="button"
            class="ac-row ac-field"
            :class="{ 'is-open': peek === index }"
            :tabindex="done ? 0 : -1"
            :aria-expanded="peek === index"
            @click="choose(index)"
          >
            <span class="ac-ln">{{ index + 2 }}</span>
            <code class="ac-code"
              ><span class="tk ac-key" :data-line="index + 1" data-order="0">"{{ field.key }}"</span
              ><span class="tk" :data-line="index + 1" data-order="1">: </span
              ><span
                class="tk ac-value"
                :class="`ac-value--${field.kind}`"
                :data-line="index + 1"
                data-order="2"
                >{{ field.value }}</span
              ><span
                v-if="index < fields.length - 1"
                class="tk"
                :data-line="index + 1"
                data-order="3"
                >,</span
              ></code
            >
            <span class="ac-leader" aria-hidden="true" />
            <span class="ac-note" :style="{ '--n': field.note.length }"
              ><span class="ac-note-text"
                ><span v-for="(char, n) in field.note" :key="n" class="ch" :style="{ '--c': n }">{{
                  char
                }}</span></span
              ><span class="ac-count"
                >{{ clues.filter((clue) => clue.field === index).length }} 处依据</span
              ></span
            >
          </button>
          <div class="ac-row ac-row--brace">
            <span class="ac-ln">{{ fields.length + 2 }}</span
            ><code><span class="tk" :data-line="fields.length + 1" data-order="0">}</span></code>
          </div>

          <p ref="summary" class="ac-summary" aria-hidden="true">
            {{ clues.length }} 条线索，归入 {{ fields.length }} 个字段。每一句含义，都能找回出处。
          </p>
          <div
            v-for="(clue, index) in clues"
            :key="`clue-${index}`"
            class="clue"
            :class="`clue--${clue.kind}`"
            aria-hidden="true"
          >
            <template v-if="clue.kind === 'badge'"><i />{{ clue.text }}</template>
            <template v-else-if="clue.kind === 'person'"
              ><i>{{ clue.text[0] }}</i
              ><span
                >{{ clue.text }}<small>{{ clue.sub }}</small></span
              ></template
            >
            <template v-else-if="clue.kind === 'call'"
              ><b>{{ clue.text }}</b
              >{{ clue.sub }}</template
            >
            <template v-else>{{ clue.text }}</template>
          </div>
        </div>

        <p class="ac-foot">
          <span>{{ caption }}</span
          ><span>示例数据</span>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped src="./knowledge-preview.css"></style>
