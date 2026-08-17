/** Honest bounded UTF-8 reads shared by global and workspace memory injection. */

import { readFileSync } from 'node:fs'

/** A bounded file read: the stored text plus whether the budget clipped it. */
export interface BoundedText {
  /** File content, truncated to the requested code-point budget. */
  text: string
  /** True when the budget clipped the original content. */
  truncated: boolean
}

function isEnoent(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === 'ENOENT'
}

/** Read a UTF-8 file; only a genuinely missing path becomes empty text. */
export function readBounded(path: string, budget: number): BoundedText {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch (error) {
    if (isEnoent(error)) return { text: '', truncated: false }
    throw error
  }
  if (raw.length === 0) return { text: '', truncated: false }
  const chars = Array.from(raw)
  if (chars.length <= budget) return { text: raw, truncated: false }
  return { text: chars.slice(0, budget).join(''), truncated: true }
}
