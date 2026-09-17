export interface ElasticAnimation {
  ready: Promise<{ ok: boolean; cancelled?: boolean; error?: unknown }>
  destroy(): void
  reset(): void
  replay(): void
  info(): {
    mode: string
    frames: number
    camera: number[]
    zoom: number
    parts: { side: string; x: number; y: number; jelly: number; vx: number }[]
  }
  state: { contactCount: number; dragging: number | null }
  project(index: number): { x: number; y: number }
}

export interface ElasticModule {
  mountNexoElastic(
    host: HTMLElement,
    options: {
      autoPlay: boolean
      maxPixelRatio: number
      introDuration?: number
      viewRollDegrees?: number
    },
  ): ElasticAnimation
}

// Simple collision merge / 08; the coupled interaction and fixed view remain unchanged.
export async function loadElasticModule(): Promise<ElasticModule> {
  // Absolute same-origin URL avoids Vite's ?import transform on files in public/.
  const url = new URL(
    `${import.meta.env.BASE_URL}nexofolio/nexofolio-elastic.mjs?v=08`,
    window.location.origin,
  ).href
  return import(/* @vite-ignore */ url) as Promise<ElasticModule>
}
