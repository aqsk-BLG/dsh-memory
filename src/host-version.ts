/**
 * Host-version self-check for the dsh-memory facade. DeepSeek Harness does not publish one shared
 * runtime version object, so the host release version is detected from the installed `@deepseek-ai/*`
 * packages (all official releases are versioned in lockstep, e.g. `0.1.0-rc.7`) or from an explicit
 * `DSH_VERSION` environment variable. The facade refuses to load on hosts older than the supported
 * floor, warns without crashing when the version cannot be determined, and is silent when disabled.
 * @module dsh-memory/host-version
 */

import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Minimal logger shape the gate reports through (satisfied by cordis loggers). */
export interface GateLogger {
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
}

/** Oldest DeepSeek Harness release this plugin was developed and tested against. */
export const MIN_HOST_VERSION = '0.1.0-rc.7'

/**
 * Installed `@deepseek-ai/*` packages probed for the lockstep harness version, in preference order.
 * The CLI package carries the canonical release version; the two hard peers always exist wherever
 * this plugin can load at all.
 */
const PROBE_PACKAGES = [
  '@deepseek-ai/dsh',
  '@deepseek-ai/dsh-home-paths',
  '@deepseek-ai/dsh-agent',
] as const

/** Where a detected version string came from. */
export type HostVersionSource = 'env' | 'package'

/** One successfully detected host version. */
export interface HostVersionInfo {
  /** The raw version string, e.g. `0.1.0-rc.7`. */
  version: string
  /** Whether the string came from `DSH_VERSION` or an installed package manifest. */
  source: HostVersionSource
  /** Package manifest the version was read from, when `source` is `package`. */
  packageName?: string
}

/** How the version gate should behave at load. */
export type VersionGateMode = 'error' | 'warn' | 'off'

/** Assessment of a detected host version against the supported floor. */
export interface HostVersionAssessment {
  /** Whether the host is inside the supported range. */
  supported: boolean
  /** Why: exactly the floor, above it, below it, unparseable, or not detectable. */
  reason: 'ok' | 'below-min' | 'unknown' | 'absent'
}

/**
 * Read one installed package's own `package.json` version by resolving the package entry and
 * walking up until a manifest with the matching package name appears.
 * @param packageName - the bare package name to resolve, e.g. `@deepseek-ai/dsh`.
 * @returns the manifest version, or `undefined` when the package or its manifest is unavailable.
 */
function readPackageVersion(packageName: string): string | undefined {
  try {
    const require = createRequire(import.meta.url)
    const entry = require.resolve(packageName)
    let dir = dirname(entry)
    for (let depth = 0; depth < 10; depth++) {
      const candidate = join(dir, 'package.json')
      if (existsSync(candidate)) {
        const manifest = JSON.parse(readFileSync(candidate, 'utf8')) as {
          name?: unknown
          version?: unknown
        }
        if (manifest.name === packageName && typeof manifest.version === 'string'
          && manifest.version.length > 0) {
          return manifest.version
        }
      }
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  } catch {
    // Package not installed or not resolvable from the bundle location; try the next probe.
  }
  return undefined
}

/**
 * Detect the DeepSeek Harness release version at load time.
 * @returns version info, or `undefined` when nothing readable was found.
 */
export function detectHostVersion(): HostVersionInfo | undefined {
  const env = process.env.DSH_VERSION?.trim()
  if (env) return { version: env, source: 'env' }
  for (const packageName of PROBE_PACKAGES) {
    const version = readPackageVersion(packageName)
    if (version !== undefined) {
      return { version, source: 'package', packageName }
    }
  }
  return undefined
}

/** Parsed loose semver: numeric core plus an optional prerelease tag list. */
interface LooseVersion {
  major: number
  minor: number
  patch: number
  prerelease: readonly (string | number)[]
}

/** Parse `major.minor.patch[-pre]`-style version strings into comparable parts. */
export function parseLooseVersion(raw: string): LooseVersion | undefined {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(raw.trim())
  if (!match) return undefined
  const prerelease = match[4]
    ? match[4].split('.').map(part => /^\d+$/.test(part) ? Number(part) : part)
    : []
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease,
  }
}

/**
 * Compare two parsed versions. A released version (empty prerelease) ranks above any prerelease
 * of the same core; numeric prerelease parts compare numerically.
 * @returns negative, zero, or positive like `a - b`.
 */
export function compareLooseVersions(a: LooseVersion, b: LooseVersion): number {
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (a[key] !== b[key]) return a[key] - b[key]
  }
  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0
  if (a.prerelease.length === 0) return 1
  if (b.prerelease.length === 0) return -1
  const length = Math.max(a.prerelease.length, b.prerelease.length)
  for (let index = 0; index < length; index++) {
    const left = a.prerelease[index]
    const right = b.prerelease[index]
    if (left === undefined) return -1
    if (right === undefined) return 1
    if (left === right) continue
    if (typeof left === 'number' && typeof right === 'number') return left - right
    if (typeof left === 'number') return -1
    if (typeof right === 'number') return 1
    return left < right ? -1 : 1
  }
  return 0
}

/**
 * Assess a detected host version against the supported floor.
 * @param info - detected version info, or `undefined` when nothing was detectable.
 * @returns the support assessment.
 */
export function assessHostVersion(info: HostVersionInfo | undefined): HostVersionAssessment {
  if (info === undefined) return { supported: false, reason: 'absent' }
  const parsed = parseLooseVersion(info.version)
  const floor = parseLooseVersion(MIN_HOST_VERSION)
  if (!parsed || !floor) return { supported: false, reason: 'unknown' }
  return compareLooseVersions(parsed, floor) >= 0
    ? { supported: true, reason: 'ok' }
    : { supported: false, reason: 'below-min' }
}

/** Human-readable description of what was detected. */
function describe(info: HostVersionInfo | undefined): string {
  if (info === undefined) return 'no DeepSeek Harness version could be detected'
  const origin = info.source === 'env'
    ? 'DSH_VERSION environment variable'
    : `package manifest of ${info.packageName ?? 'an installed @deepseek-ai package'}`
  return `detected ${info.version} from the ${origin}`
}

/**
 * The loud-fail message thrown for provably unsupported hosts.
 * @param pluginVersion - the dsh-memory version string, embedded in the failure.
 */
export function unsupportedHostMessage(pluginVersion: string): string {
  return `dsh-memory ${pluginVersion} requires DeepSeek Harness >= ${MIN_HOST_VERSION}`
}

/** Read this plugin's own manifest version from the installed bundle location. */
export function readOwnVersion(): string {
  try {
    let dir = dirname(fileURLToPath(import.meta.url))
    for (let depth = 0; depth < 10; depth++) {
      const candidate = join(dir, 'package.json')
      if (existsSync(candidate)) {
        const manifest = JSON.parse(readFileSync(candidate, 'utf8')) as {
          name?: unknown
          version?: unknown
        }
        if (manifest.name === 'dsh-memory' && typeof manifest.version === 'string') {
          return manifest.version
        }
      }
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  } catch {
    // Manifest unreadable; report an unknown version rather than failing the gate.
  }
  return 'unknown'
}

/**
 * Enforce the host-version policy once at facade load.
 *
 * - At or above the floor: one info line.
 * - Below the floor: a loud error by default (the plugin row fails to load), downgradeable to a
 *   warning with `versionGate: 'warn'` for pinned community forks.
 * - Undetectable or unparseable: warn only. An unknown version is not proof of incompatibility,
 *   so the plugin keeps running and reports it.
 * @param logger - the registrant logger to report through.
 * @param mode - `error`, `warn`, or `off`.
 * @param pluginVersion - the dsh-memory version string, embedded in failure messages.
 */
export function enforceHostVersionGate(
  logger: GateLogger,
  mode: VersionGateMode,
  pluginVersion = readOwnVersion(),
): void {
  if (mode === 'off') return
  const info = detectHostVersion()
  const assessment = assessHostVersion(info)
  if (assessment.reason === 'ok') {
    logger.info(`dsh-memory: host DeepSeek Harness ${describe(info)} — supported (>= ${MIN_HOST_VERSION})`)
    return
  }
  if (assessment.reason === 'below-min') {
    const message = `${unsupportedHostMessage(pluginVersion)} (${describe(info)}). `
      + 'Upgrade DeepSeek Harness, pin dsh-memory to v1.1.x, or set versionGate to warn/off if you '
      + 'maintain a compatible fork.'
    if (mode === 'error') throw new Error(message)
    logger.warn(`dsh-memory: ${message}`)
    return
  }
  // absent or unknown: warn, never crash, because the host may simply hide its version.
  logger.warn(`dsh-memory: ${describe(info)}; the host version gate cannot verify compatibility. `
    + `Continuing because nothing is provably missing (${assessment.reason}).`)
}
