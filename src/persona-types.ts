/** Durable event vocabulary for frozen Harness-home persona files. @module dsh-memory/persona-types */

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * Frozen `IDENTITY.md` and `SOUL.md` snapshot injected for one session.
     * Log-only: replay uses this event rather than rereading mutable files.
     */
    'persona/bootstrap': {
      /** Bounded `IDENTITY.md` content. */
      identity: string
      /** Whether the identity budget clipped the file. */
      identityTruncated: boolean
      /** Bounded `SOUL.md` content. */
      soul: string
      /** Whether the soul budget clipped the file. */
      soulTruncated: boolean
    }
  }
}

export {}
