/**
 * Browser half: one Plugins-tab card keyed on the `memory` settings namespace.
 */
import type { ClientContext, SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { MemoryCard, type MemoryPanelSettings } from './MemoryCard.tsx'
import { en, zh } from './locales.ts'

/** Cordis client plugin name. */
export const name = 'dsh-file-memory-client'

/** Dictionary namespace for this card's copy. */
const NS = 'settings.dshFileMemory'

/** Required browser services. settingsScope.bind needs connection + remote. */
export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope']

/**
 * Register the memory card. Host must serve the same `memory` namespace.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-file-memory: settings card dictionaries')
  const scope: SettingsScope<MemoryPanelSettings> = ctx.settingsScope.bind({ namespace: 'memory' })
  ctx.slots.inject('settings.plugin.item', function* () {
    yield ctx.slots.register({
      name: 'settings.plugin.item',
      key: 'memory',
      locale: NS,
      inject: () => ({ scope }),
    }, MemoryCard)
  })
}
