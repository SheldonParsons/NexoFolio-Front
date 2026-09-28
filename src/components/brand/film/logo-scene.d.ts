export const DURATION: number
export const CAPTION_AT: number
export interface LogoFilm {
  replay(): void
  seek(time: number): void
  toggle(): void
  setSpeed(speed: number): void
  setLoop(loop: boolean): void
  destroy(): void
}
export function createLogoScene(host: HTMLElement, callbacks: {
  onFrame(time: number): void
  onPlay(playing: boolean): void
  onReady(reducedMotion: boolean): void
  onError(): void
}): LogoFilm
