import type { ReviewLine } from './reviewLines'

/** Align additions and removals by knowledge label, not their row positions. */
export function reviewComparison(before: ReviewLine[], after: ReviewLine[]) {
  const previous = new Map(before.map((line) => [line.label, line]))
  const proposed = new Map(after.map((line) => [line.label, line]))
  return [...new Set([...previous.keys(), ...proposed.keys()])].map((label) => ({
    label,
    before: previous.get(label),
    after: proposed.get(label),
    changed:
      JSON.stringify(previous.get(label)?.values ?? []) !==
      JSON.stringify(proposed.get(label)?.values ?? []),
  }))
}
