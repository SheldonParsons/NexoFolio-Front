import { compareSamples, type DiffInput } from './diff'
self.onmessage = (
  event: MessageEvent<{ id: number; inputs: DiffInput[]; align: 'position' | 'id' }>,
) => {
  try {
    self.postMessage({
      id: event.data.id,
      result: compareSamples(event.data.inputs, event.data.align),
    })
  } catch {
    self.postMessage({ id: event.data.id, error: '暂时无法比较这些样本，请缩小选择范围或重试' })
  }
}
