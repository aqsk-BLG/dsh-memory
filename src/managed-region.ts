/**
 * Dependency-free parsing and rewriting for the only curated-file region the
 * background consolidator owns.
 */

/** Marker opening the only curated-file region this plugin owns. */
export const MANAGED_REGION_START = '<!-- dsh-memory-consolidator:start -->'
/** Marker closing the only curated-file region this plugin owns. */
export const MANAGED_REGION_END = '<!-- dsh-memory-consolidator:end -->'
/** Heading introduced when a file first receives a managed region. */
export const MANAGED_REGION_HEADING = '## Consolidated memory'

/** Parsed state of one managed region. */
export interface ManagedInspection {
  valid: boolean
  entries: string[]
}

/** Inspect an owned region without interpreting manual text outside it. */
export function inspectManagedRegion(content: string): ManagedInspection {
  const start = content.indexOf(MANAGED_REGION_START)
  const end = content.indexOf(MANAGED_REGION_END)
  const duplicateStart = start >= 0
    && content.indexOf(MANAGED_REGION_START, start + MANAGED_REGION_START.length) >= 0
  const duplicateEnd = end >= 0
    && content.indexOf(MANAGED_REGION_END, end + MANAGED_REGION_END.length) >= 0
  if (start < 0 && end < 0) return { valid: true, entries: [] }
  if (start < 0 || end < 0 || duplicateStart || duplicateEnd || end < start) {
    return { valid: false, entries: [] }
  }
  const inner = content.slice(start + MANAGED_REGION_START.length, end).trim()
  if (inner.length === 0) return { valid: true, entries: [] }
  const lines = inner.split(/\r?\n/u).filter(line => line.trim().length > 0)
  if (lines.some(line => !line.startsWith('- ') || line.slice(2).trim().length === 0)) {
    return { valid: false, entries: [] }
  }
  return { valid: true, entries: lines.map(line => line.slice(2).trim()) }
}

function renderManagedRegion(entries: readonly string[]): string {
  const body = entries.map(entry => `- ${entry}`).join('\n')
  return `${MANAGED_REGION_START}\n${body}${body.length === 0 ? '' : '\n'}${MANAGED_REGION_END}`
}

/** Code-point size used by the reviewer contract for one non-empty managed region. */
export function managedRegionCodePoints(entries: readonly string[]): number {
  if (entries.length === 0) return 0
  return Array.from(renderManagedRegion(entries)).length
}

/**
 * Replace only the owned region, or append it without changing any pre-existing
 * manual byte when a file receives its first managed entries.
 */
export function rewriteManagedRegion(content: string, entries: readonly string[]): string {
  const inspection = inspectManagedRegion(content)
  if (!inspection.valid) throw new Error('managed region is malformed or duplicated')
  const start = content.indexOf(MANAGED_REGION_START)
  const region = renderManagedRegion(entries)
  if (start >= 0) {
    const end = content.indexOf(MANAGED_REGION_END, start)
    return content.slice(0, start) + region + content.slice(end + MANAGED_REGION_END.length)
  }
  if (entries.length === 0) return content
  const separator = content.length === 0
    ? ''
    : /(?:\r?\n){2}$/u.test(content) ? '' : /\r?\n$/u.test(content) ? '\n' : '\n\n'
  return `${content}${separator}${MANAGED_REGION_HEADING}\n\n${region}\n`
}
