import { describe, expect, it } from 'vitest'

interface NoteListItem {
  id: string
  text: string
  createdAt: string
}

function buildNoteItems(count: number): NoteListItem[] {
  const items: NoteListItem[] = []
  for (let index = 0; index < count; index += 1) {
    items.push({
      id: `note-${index.toString().padStart(4, '0')}`,
      text: `Note ${index + 1}`,
      createdAt: `2026-01-01T00:${Math.floor(index / 60)
        .toString()
        .padStart(2, '0')}:${(index % 60).toString().padStart(2, '0')}.000Z`,
    })
  }
  return items
}

function simulateNoteScrollTraversal(items: NoteListItem[], windowSize: number, step: number): string[] {
  const renderedKeys: string[] = []
  if (items.length === 0) {
    return renderedKeys
  }

  for (let start = 0; start < items.length; start += step) {
    const end = Math.min(start + windowSize, items.length)
    for (let cursor = start; cursor < end; cursor += 1) {
      renderedKeys.push(items[cursor]!.id)
    }
    if (end === items.length) {
      break
    }
  }

  return renderedKeys
}

function countUnique(values: string[]): number {
  return new Set(values).size
}

describe('notes list contract', () => {
  it('produces deterministic traversal order for the same dataset and scroll window', () => {
    const dataset = buildNoteItems(500)
    const firstTraversal = simulateNoteScrollTraversal(dataset, 18, 6)
    const secondTraversal = simulateNoteScrollTraversal(dataset, 18, 6)

    expect(secondTraversal).toEqual(firstTraversal)
    expect(firstTraversal.at(0)).toBe('note-0000')
    expect(firstTraversal.at(-1)).toBe('note-0499')
  })

  it('covers the full dataset during simulated scroll traversal', () => {
    const dataset = buildNoteItems(750)
    const traversal = simulateNoteScrollTraversal(dataset, 20, 8)
    const uniqueRendered = countUnique(traversal)

    expect(uniqueRendered).toBe(dataset.length)
  })

  it('keeps note traversal benchmark within performance threshold', () => {
    const dataset = buildNoteItems(2000)
    const startedAt = performance.now()
    const traversal = simulateNoteScrollTraversal(dataset, 24, 8)
    const elapsedMs = performance.now() - startedAt

    expect(traversal.length).toBeGreaterThan(dataset.length)
    expect(elapsedMs).toBeLessThan(20)
  })
})
