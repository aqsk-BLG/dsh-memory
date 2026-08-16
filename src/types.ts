/**
 * Durable vocabulary of the memory bootstrap injection: the frozen per-session snapshot event.
 * @module dsh-memory/types
 */

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * Frozen per-session snapshot of the global memory files injected into the
     * system prompt. Appended once per session, when the `memory` prompt
     * section is registered. Log-only: replay rebuilds the model's view from
     * this event instead of re-reading the files, because the files may have
     * changed since the snapshot froze. `*Truncated` is true when the
     * corresponding budget clipped the stored text.
     */
    'memory/bootstrap': {
      /** Content of the user-profile file (`$DSH_HOME/USER.md`) at snapshot time. */
      user: string
      /** True when `userBudgetChars` clipped the user-profile content. */
      userTruncated: boolean
      /** Content of the global memory file (`$DSH_HOME/MEMORY.md`) at snapshot time. */
      memory: string
      /** True when `memoryBudgetChars` clipped the global-memory content. */
      memoryTruncated: boolean
    }
  }
}

export {}
