/**
 * Settings-card host half: register the `memory` settings namespace and the
 * loopback file-panel HTTP routes. Safe if settings or webServer is absent.
 */
import type { Context } from '@deepseek-ai/cordis'
import type z from '@deepseek-ai/schemastery'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { registerMemoryPanelHttp } from './panel-http.ts'

/** Settings namespace paired with the browser card key. */
export const MEMORY_SETTINGS_NAMESPACE = settingsNamespace('memory')

/** Resolve the same home the rest of the facade uses. */
export function resolveMemoryPanelHome(dshHome?: string): string {
  return resolveDshHome(dshHome)
}

/**
 * Register the settings namespace and file routes.
 * Config writes apply on the next DSH start; file saves write the disk now.
 */
export function applyMemoryPanel<T extends { dshHome?: string }>(
  ctx: Context,
  schema: z<T>,
  config: T,
): void {
  installSettingsSection(ctx, MEMORY_SETTINGS_NAMESPACE, schema, config, {
    setSource: () => {
      // Child plugins keep the composition entry until the next DSH start.
    },
    onChange: () => {
      // Knob writes persist now; live remount of the five parts is v2 work.
    },
  })
  registerMemoryPanelHttp(ctx, resolveMemoryPanelHome(config.dshHome))
}
