/**
 * Durable vocabulary for background memory consolidation. Both events are log-only: the request
 * records the exact auxiliary model input, while the result records validated candidates and the
 * outcome of each controlled file target.
 * @module dsh-memory/consolidator-types
 */

import type { Message } from '@deepseek-ai/dsh-llm/types'

/** Whether a review may write files or only publish a proposal. */
export type MemoryConsolidationMode = 'automatic' | 'proposal'

/** Exact provider/model route used by one background review. */
export interface MemoryConsolidationRoute {
  provider: string
  model: string
}

/** Live workspace authority captured before one review. */
export type MemoryConsolidationWorkspace =
  | { kind: 'global-only' | 'ungrouped' }
  | {
    kind: 'workspace'
    workspacePath: string
    curatedMemoryFile: string
    dailyFile: string
  }

/** One file snapshot against which a controlled commit performs conflict detection. */
export interface MemoryConsolidationFileSnapshot {
  target: 'user' | 'global' | 'project' | 'daily'
  path: string
  contentHash: string
  existed: boolean
  managedRegionValid: boolean
}

/** Validated complete managed entries plus new daily-log entries returned by the reviewer. */
export interface MemoryConsolidationCandidates {
  user: string[]
  global: string[]
  project: string[]
  daily: string[]
}

/** Auditable managed-list change counts without duplicating memory text into result metadata. */
export interface MemoryConsolidationEntryDiff {
  added: number
  kept: number
  removed: number
}

/** Per-file commit result retained even when another target fails. */
export interface MemoryConsolidationTargetOutcome {
  target: 'user' | 'global' | 'project' | 'daily'
  path: string
  status: 'applied' | 'noop' | 'proposed' | 'skipped' | 'conflict' | 'failed'
  /** Managed-list change counts; omitted for append-only daily logs. */
  diff?: MemoryConsolidationEntryDiff
  /** Safe diagnostic or proposal reason. */
  error?: string
}

/** Persisted retry control for an unfinished source batch. */
export interface MemoryConsolidationRetry {
  /** Hash of the batch boundary, file snapshot, and safe failure signature. */
  fingerprint: string
  /** Consecutive occurrence count for the same fingerprint. */
  attempt: number
  /** Transient failures wait; malformed managed regions wait for file repair. */
  disposition: 'backoff' | 'file-change'
  /** Hash of the file snapshot used to detect an operator repair or conflict change. */
  fileStateHash?: string
  /** Earliest retry time for transient failures, in epoch milliseconds. */
  retryAfter?: number
}

/** Overall result of one review. Retryable mixed results do not advance the durable watermark. */
export type MemoryConsolidationResultStatus =
  | 'applied'
  | 'noop'
  | 'proposed'
  | 'partial'
  | 'conflict'
  | 'failed'

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * Exact tools-free auxiliary request made by the background memory consolidator. The source
     * seqs identify every turn event represented in `messages`; `throughSeq` is the candidate
     * batch boundary used by the result watermark.
     */
    'memory/consolidation-request': {
      throughSeq: number
      sourceTurns: number[]
      sourceEventSeqs: number[]
      route: MemoryConsolidationRoute
      system: string
      messages: Message[]
      maxTokens: number
      mode: MemoryConsolidationMode
      workspace: MemoryConsolidationWorkspace
      files: MemoryConsolidationFileSnapshot[]
    }
    /**
     * Validated review output and controlled commit outcomes. Applied, noop, and proposed advance
     * the watermark. A partial result advances only when its non-success outcomes are terminal
     * skipped writes; a conflict or failed target retains the batch for a controlled retry.
     * Invalid raw model output is represented only by rawTextHash.
     */
    'memory/consolidation-result': {
      throughSeq: number
      status: MemoryConsolidationResultStatus
      candidates: MemoryConsolidationCandidates
      outcomes: MemoryConsolidationTargetOutcome[]
      retry?: MemoryConsolidationRetry
      rawTextHash?: string
      error?: string
    }
  }
}

export {}
