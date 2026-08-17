/**
 * Provider-neutral extraction of the semantic ranker's visible JSON response.
 * Reasoning-capable models may emit hidden reasoning before the final text; that
 * metadata is not ranking data and must not force an otherwise valid response
 * into lexical fallback.
 */

/** Minimal structural view shared by assembled LLM content blocks. */
export interface RankingOutputBlock {
  type: string
  text?: string
}

/**
 * Collect final text while ignoring provider reasoning blocks.
 * Other block kinds stay invalid because the ranker is a tools-free text call.
 */
export function collectSemanticRankingText(blocks: readonly RankingOutputBlock[]): string {
  const texts: string[] = []
  for (const block of blocks) {
    if (block.type === 'reasoning') continue
    if (block.type !== 'text' || typeof block.text !== 'string') {
      throw new Error(`semantic ranking output contains unsupported block type "${block.type}"`)
    }
    texts.push(block.text)
  }
  const text = texts.join('')
  if (text.trim().length === 0) throw new Error('semantic ranking produced no text')
  return text
}
