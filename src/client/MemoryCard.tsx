import {
  useCallback, useEffect, useState, useSyncExternalStore,
  type CSSProperties, type ReactNode,
} from 'react'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'

type FileId = 'identity' | 'soul' | 'user' | 'memory'

interface FileInfo {
  id: FileId
  name: string
  path: string
  exists: boolean
  bytes: number
  chars: number
  managed: 'none' | 'valid' | 'malformed'
}

interface FileContent extends FileInfo {
  content: string
  contentHash: string
}

interface Status {
  pluginVersion: string
  minHostVersion: string
  host?: { version: string }
  hostAssessment: { supported: boolean, reason: string }
  home: string
  files: FileInfo[]
  sessionQuery: { exists: boolean, bytes: number }
  lastConsolidation?: { sessionId: string, status?: string, updatedAt?: string }
}

interface WriteResult {
  ok: boolean
  reason?: string
  message?: string
  file?: FileContent
}

/** Common knobs the card writes through the official `memory` settings namespace. */
export interface MemoryPanelSettings {
  reminderEnabled?: boolean
  semanticEnabled?: boolean
  semanticFallbackEnabled?: boolean
  flushEnabled?: boolean
  consolidationEnabled?: boolean
  consolidationMode?: 'automatic' | 'proposal'
  consolidationEveryEligibleTurns?: number
  memoryBudgetChars?: number
  userBudgetChars?: number
  projectMemoryBudgetChars?: number
}

/** Injected by the client plugin: the bound `memory` settings scope. */
export interface MemoryCardProps {
  scope?: SettingsScope<MemoryPanelSettings>
}

const API = '/api/plugins/dsh-file-memory'
const FILES: { id: FileId, label: string }[] = [
  { id: 'identity', label: 'IDENTITY' },
  { id: 'soul', label: 'SOUL' },
  { id: 'user', label: 'USER' },
  { id: 'memory', label: 'MEMORY' },
]

const FLAGS: { field: keyof MemoryPanelSettings, cn: string, en: string }[] = [
  { field: 'reminderEnabled', cn: '每轮提醒', en: 'Turn reminder' },
  { field: 'semanticEnabled', cn: '语义召回', en: 'Semantic recall' },
  { field: 'semanticFallbackEnabled', cn: '全文回退', en: 'Full-text fallback' },
  { field: 'flushEnabled', cn: '压缩后冲刷', en: 'Compaction flush' },
  { field: 'consolidationEnabled', cn: '后台巩固', en: 'Background consolidation' },
]

const NUMBERS: { field: keyof MemoryPanelSettings, cn: string, en: string, min: number }[] = [
  { field: 'consolidationEveryEligibleTurns', cn: '每 N 个合格轮次巩固一次', en: 'Consolidate every N eligible turns', min: 1 },
  { field: 'memoryBudgetChars', cn: 'MEMORY 预算', en: 'MEMORY budget', min: 1 },
  { field: 'userBudgetChars', cn: 'USER 预算', en: 'USER budget', min: 1 },
  { field: 'projectMemoryBudgetChars', cn: '项目 MEMORY 预算', en: 'Project MEMORY budget', min: 1 },
]

const EMPTY: SettingsScopeSnapshot<MemoryPanelSettings> = {
  status: 'unavailable',
  value: undefined,
  base: undefined,
  user: undefined,
  revision: undefined,
  writable: false,
  mode: 'memory',
}

const page: CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: '4px 2px 12px',
  color: 'var(--dsw-alias-label-primary, #e8eef7)',
  fontFamily: 'inherit',
}
const h: CSSProperties = { margin: 0, fontSize: 16, fontWeight: 650 }
const p: CSSProperties = {
  margin: 0,
  color: 'var(--dsw-alias-label-secondary, #9aa8bd)',
  fontSize: 13,
  lineHeight: 1.45,
}
const card: CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 12,
  border: '1px solid var(--dsw-alias-border-default, #2a3545)',
  borderRadius: 10,
  background: 'var(--dsw-alias-bg-layer-1, #151b24)',
}
const row: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }
const chip = (on: boolean): CSSProperties => ({
  border: `1px solid ${on ? 'var(--dsw-alias-brand-primary, #4da3ff)' : 'var(--dsw-alias-border-default, #2a3545)'}`,
  background: on ? 'color-mix(in srgb, var(--dsw-alias-brand-primary, #4da3ff) 18%, transparent)' : 'transparent',
  color: 'inherit',
  borderRadius: 999,
  padding: '4px 10px',
  cursor: 'pointer',
  font: 'inherit',
})
const area: CSSProperties = {
  width: '100%',
  minHeight: 240,
  resize: 'vertical',
  boxSizing: 'border-box',
  padding: 10,
  borderRadius: 8,
  border: '1px solid var(--dsw-alias-border-default, #2a3545)',
  background: 'var(--dsw-alias-bg-layer-0, #0f141b)',
  color: 'inherit',
  font: '12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
}
const btn: CSSProperties = {
  border: '1px solid var(--dsw-alias-border-default, #2a3545)',
  background: 'var(--dsw-alias-bg-layer-2, #1c2430)',
  color: 'inherit',
  borderRadius: 8,
  padding: '6px 12px',
  cursor: 'pointer',
  font: 'inherit',
}
const input: CSSProperties = {
  width: 112,
  boxSizing: 'border-box',
  padding: '4px 8px',
  borderRadius: 8,
  border: '1px solid var(--dsw-alias-border-default, #2a3545)',
  background: 'var(--dsw-alias-bg-layer-0, #0f141b)',
  color: 'inherit',
  font: 'inherit',
}
const warn: CSSProperties = { margin: 0, color: 'var(--dsw-alias-label-warning, #e0b15a)', fontSize: 12 }
const tiny: CSSProperties = { ...btn, padding: '2px 8px', fontSize: 12 }

function fieldOverridden(user: unknown, field: string): boolean {
  return typeof user === 'object' && user !== null && !Array.isArray(user)
    && Object.prototype.hasOwnProperty.call(user, field)
}

function useSettings(scope?: SettingsScope<MemoryPanelSettings>): SettingsScopeSnapshot<MemoryPanelSettings> {
  return useSyncExternalStore(
    listener => (scope === undefined ? () => {} : scope.subscribe(listener)),
    () => (scope === undefined ? EMPTY : scope.getSnapshot()),
    () => (scope === undefined ? EMPTY : scope.getSnapshot()),
  )
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return await res.json() as T
}

function NumberField(props: {
  label: string
  hint: string
  value: number | undefined
  min: number
  overridden: boolean
  disabled: boolean
  onCommit: (value: number) => void
  onReset: () => void
}): ReactNode {
  const [text, setText] = useState(props.value === undefined ? '' : String(props.value))
  useEffect(() => {
    setText(props.value === undefined ? '' : String(props.value))
  }, [props.value])
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span>{props.label}</span>
      <span style={p}>{props.hint}</span>
      <span style={row}>
        <input
          style={input}
          type="number"
          min={props.min}
          value={text}
          disabled={props.disabled}
          onChange={event => {
            setText(event.target.value)
          }}
          onBlur={() => {
            const next = Number(text)
            if (Number.isFinite(next) && next >= props.min) props.onCommit(Math.floor(next))
          }}
        />
        {props.overridden
          ? (
            <button type="button" style={tiny} disabled={props.disabled} onClick={props.onReset}>
              重置 / Reset
            </button>
          )
          : null}
      </span>
    </label>
  )
}

/** Settings card: status, four core files, common toggles. */
export function MemoryCard(props: MemoryCardProps): ReactNode {
  const [status, setStatus] = useState<Status>()
  const [active, setActive] = useState<FileId>('memory')
  const [draft, setDraft] = useState('')
  const [hash, setHash] = useState('')
  const [info, setInfo] = useState<FileContent>()
  const [note, setNote] = useState<string>()
  const [busy, setBusy] = useState(false)
  const settings = useSettings(props.scope)
  const knobs = settings.value
  const disabled = !settings.writable || settings.status !== 'ready' || knobs === undefined

  const reloadStatus = useCallback(async () => {
    setStatus(await getJson<Status>(`${API}/status`))
  }, [])

  const loadFile = useCallback(async (id: FileId) => {
    const file = await getJson<FileContent>(`${API}/files/${id}`)
    setActive(id)
    setInfo(file)
    setDraft(file.content)
    setHash(file.contentHash)
    setNote(undefined)
  }, [])

  useEffect(() => {
    void reloadStatus().then(() => loadFile('memory')).catch((error: unknown) => {
      setNote(error instanceof Error ? error.message : String(error))
    })
  }, [loadFile, reloadStatus])

  const save = async () => {
    setBusy(true)
    try {
      const res = await fetch(`${API}/files/${active}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: draft, expectedHash: hash }),
      })
      const body = await res.json() as WriteResult
      if (!body.ok) {
        setNote(body.message ?? body.reason ?? 'save failed')
        if (body.file) {
          setInfo(body.file)
          setHash(body.file.contentHash)
        }
        return
      }
      if (body.file) {
        setInfo(body.file)
        setDraft(body.file.content)
        setHash(body.file.contentHash)
      }
      setNote('已保存。下一轮会话才会注入提示词。 / Saved. Next session turn picks this up.')
      await reloadStatus()
    } catch (error) {
      setNote(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const hostLine = status === undefined
    ? '读取中… / Loading…'
    : `${status.host?.version ?? '未知宿主 / unknown host'} · plugin ${status.pluginVersion} · gate ${status.hostAssessment.reason}`
  const cons = status?.lastConsolidation

  return (
    <div style={page}>
      <div>
        <h3 style={h}>dsh-file-memory</h3>
        <p style={p}>分层文件记忆。状态只读；USER / MEMORY / IDENTITY / SOUL 可看可改。</p>
        <p style={p}>Layered file memory. Status is read-only; the four core files are editable.</p>
      </div>
      <section style={card}>
        <strong>状态 / Status</strong>
        <p style={p}>{hostLine}</p>
        <p style={p}>Home：{status?.home ?? '—'}</p>
        <p style={p}>
          召回索引 / Recall index：{status?.sessionQuery.exists ? `${status.sessionQuery.bytes} bytes` : '未建立 / missing'}
        </p>
        <p style={p}>
          最近巩固 / Last consolidation：{cons ? `${cons.status ?? 'unknown'} · ${cons.updatedAt ?? cons.sessionId}` : '还没有 / none'}
        </p>
      </section>
      <section style={card}>
        <strong>核心文件 / Core files</strong>
        <p style={p}>USER / MEMORY 保存时会校验 consolidator 受管区。人手写的区域不会被巩固器改。</p>
        <p style={p}>Saves validate the consolidator managed region. Human-written sections stay untouched.</p>
        <div style={row}>
          {FILES.map(file => (
            <button
              key={file.id}
              type="button"
              style={chip(active === file.id)}
              onClick={() => { void loadFile(file.id) }}
            >
              {file.label}
              {status?.files.find(item => item.id === file.id)?.exists ? '' : ' · 缺'}
            </button>
          ))}
        </div>
        <p style={p}>
          {info?.path ?? ''}
          {info?.managed === 'malformed' ? ' · 受管区损坏 / malformed region' : ''}
          {info ? ` · ${info.chars} chars` : ''}
        </p>
        <textarea
          style={area}
          value={draft}
          onChange={event => {
            setDraft(event.target.value)
          }}
          spellCheck={false}
        />
        <div style={row}>
          <button type="button" style={btn} disabled={busy} onClick={() => { void save() }}>
            保存 / Save
          </button>
          <button type="button" style={btn} disabled={busy} onClick={() => { void loadFile(active) }}>
            重新加载 / Reload
          </button>
        </div>
        {note ? <p style={warn}>{note}</p> : null}
      </section>
      <section style={card}>
        <strong>常用开关 / Common knobs</strong>
        <p style={p}>写入官方设置文档。立刻落盘，下次启动 DSH 才生效。</p>
        <p style={p}>Writes the official settings document now. Takes effect on the next DSH start.</p>
        {settings.status === 'loading' ? <p style={p}>读取设置中… / Loading settings…</p> : null}
        {settings.status === 'unavailable' || (settings.status === 'ready' && knobs === undefined)
          ? <p style={warn}>设置通道不可用。开关仍可改 `cordis.patch.yml`。 / Settings scope unavailable.</p>
          : null}
        <div style={row}>
          {FLAGS.map(flag => {
            const on = Boolean(knobs?.[flag.field])
            return (
              <span key={flag.field} style={row}>
                <button
                  type="button"
                  style={chip(on)}
                  disabled={disabled}
                  onClick={() => { void props.scope?.set(flag.field, !on) }}
                >
                  {flag.cn} / {flag.en} · {on ? '开' : '关'}
                </button>
                {fieldOverridden(settings.user, flag.field)
                  ? (
                    <button
                      type="button"
                      style={tiny}
                      disabled={disabled}
                      onClick={() => { void props.scope?.unset(flag.field) }}
                    >
                      重置 / Reset
                    </button>
                  )
                  : null}
              </span>
            )
          })}
        </div>
        <div style={row}>
          {(['automatic', 'proposal'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              style={chip(knobs?.consolidationMode === mode)}
              disabled={disabled}
              onClick={() => { void props.scope?.set('consolidationMode', mode) }}
            >
              {mode === 'automatic' ? '自动写入 / automatic' : '只提案 / proposal'}
            </button>
          ))}
          {fieldOverridden(settings.user, 'consolidationMode')
            ? (
              <button
                type="button"
                style={tiny}
                disabled={disabled}
                onClick={() => { void props.scope?.unset('consolidationMode') }}
              >
                重置 / Reset
              </button>
            )
            : null}
        </div>
        {NUMBERS.map(field => (
          <NumberField
            key={field.field}
            label={field.cn}
            hint={field.en}
            min={field.min}
            value={typeof knobs?.[field.field] === 'number' ? knobs[field.field] as number : undefined}
            overridden={fieldOverridden(settings.user, field.field)}
            disabled={disabled}
            onCommit={value => { void props.scope?.set(field.field, value) }}
            onReset={() => { void props.scope?.unset(field.field) }}
          />
        ))}
      </section>
    </div>
  )
}
