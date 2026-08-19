import {
  useCallback, useEffect, useState, useSyncExternalStore,
  type CSSProperties, type ReactNode,
} from 'react'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import { en, type MemoryLocaleKey } from './locales.ts'

type FileId = 'agents' | 'soul' | 'identity' | 'user' | 'memory'
type KnobKey = keyof MemoryPanelSettings
type Draft = Partial<{ [K in KnobKey]: MemoryPanelSettings[K] | undefined }>

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

/** Injected by the client plugin: bound scope plus official locale `t`. */
export interface MemoryCardProps {
  scope?: SettingsScope<MemoryPanelSettings>
  t?: (key: MemoryLocaleKey) => string
}

const API = '/api/plugins/dsh-file-memory'
const FILES: { id: FileId, label: string }[] = [
  { id: 'agents', label: 'AGENTS' },
  { id: 'soul', label: 'SOUL' },
  { id: 'identity', label: 'IDENTITY' },
  { id: 'user', label: 'USER' },
  { id: 'memory', label: 'MEMORY' },
]

const FLAGS: { field: KnobKey, label: MemoryLocaleKey, hint: MemoryLocaleKey }[] = [
  { field: 'reminderEnabled', label: 'reminder', hint: 'reminderHint' },
  { field: 'semanticEnabled', label: 'semantic', hint: 'semanticHint' },
  { field: 'semanticFallbackEnabled', label: 'fallback', hint: 'fallbackHint' },
  { field: 'flushEnabled', label: 'flush', hint: 'flushHint' },
  { field: 'consolidationEnabled', label: 'consolidation', hint: 'consolidationHint' },
]

const NUMBERS: { field: KnobKey, label: MemoryLocaleKey, hint: MemoryLocaleKey, min: number }[] = [
  { field: 'consolidationEveryEligibleTurns', label: 'cadence', hint: 'cadenceHint', min: 1 },
  { field: 'memoryBudgetChars', label: 'memoryBudget', hint: 'memoryBudgetHint', min: 1 },
  { field: 'userBudgetChars', label: 'userBudget', hint: 'userBudgetHint', min: 1 },
  { field: 'projectMemoryBudgetChars', label: 'projectBudget', hint: 'projectBudgetHint', min: 1 },
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

const card: CSSProperties = {
  listStyle: 'none',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 12,
  background: 'var(--dsw-alias-bg-layer-3)',
  transition: 'border-color .16s, background .16s',
}
const cardOpen: CSSProperties = {
  ...card,
  background: 'var(--dsw-alias-bg-layer-2)',
  borderColor: 'var(--dsw-alias-label-dimmed)',
}
const header: CSSProperties = {
  width: '100%',
  appearance: 'none',
  border: 0,
  background: 'none',
  font: 'inherit',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '14px 16px',
  borderRadius: 12,
}
const headText: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}
const name: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  lineHeight: 1.4,
  color: 'var(--dsw-alias-label-primary)',
}
const description: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-tertiary)',
}
const pending: CSSProperties = {
  flex: 'none',
  borderRadius: 999,
  padding: '1px 8px',
  fontSize: 11,
  lineHeight: '17px',
  fontWeight: 500,
  whiteSpace: 'nowrap',
  background: 'var(--dsw-alias-bg-module-platform)',
  color: 'var(--dsw-alias-label-secondary)',
}
const body: CSSProperties = {
  borderTop: '1px solid var(--dsw-alias-border-l2)',
  margin: '0 16px',
  paddingBottom: 8,
}
const field: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '12px 0',
  borderTop: '1px solid var(--dsw-alias-border-l2)',
}
const fieldFirst: CSSProperties = { ...field, borderTop: 0 }
const fieldHead: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 }
const label: CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontSize: 13,
  fontWeight: 500,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-primary)',
}
const hint: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-tertiary)',
}
const invalid: CSSProperties = { ...hint, color: 'var(--dsw-alias-label-error)' }
const badge: CSSProperties = {
  borderRadius: 999,
  padding: '1px 8px',
  fontSize: 11,
  lineHeight: '17px',
  whiteSpace: 'nowrap',
  fontWeight: 500,
  background: 'var(--dsw-alias-bg-module-platform)',
  color: 'var(--dsw-alias-label-secondary)',
}
const resetBtn: CSSProperties = {
  border: 'none',
  background: 'none',
  padding: 0,
  font: 'inherit',
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-secondary)',
  cursor: 'pointer',
}
const input: CSSProperties = {
  height: 34,
  padding: '0 12px',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 8,
  background: 'var(--dsw-alias-bg-layer-3)',
  font: 'inherit',
  fontSize: 13,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-primary)',
}
const tabs: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-end',
  gap: 22,
  borderBottom: '1px solid var(--dsw-alias-border-l2)',
}
const tabBase: CSSProperties = {
  appearance: 'none',
  position: 'relative',
  border: 0,
  marginBottom: -1,
  padding: '7px 1px 9px',
  background: 'transparent',
  font: 'inherit',
  fontSize: 13,
  lineHeight: '20px',
  cursor: 'pointer',
}
const area: CSSProperties = {
  ...input,
  height: 'auto',
  minHeight: 220,
  padding: 12,
  resize: 'vertical',
  font: '12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
}
const footer: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  padding: '12px 0 4px',
  borderTop: '1px solid var(--dsw-alias-border-l2)',
}
const discard: CSSProperties = {
  appearance: 'none',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 8,
  padding: '5px 14px',
  font: 'inherit',
  fontSize: 13,
  lineHeight: 1.5,
  cursor: 'pointer',
  background: 'none',
  color: 'var(--dsw-alias-label-secondary)',
}
const save: CSSProperties = {
  ...discard,
  borderColor: 'transparent',
  background: 'var(--dsw-alias-label-primary)',
  color: 'var(--dsw-alias-bg-layer-3)',
}
const muted: CSSProperties = { ...hint, margin: '12px 0 0' }

function fieldOverridden(user: unknown, key: string): boolean {
  return typeof user === 'object' && user !== null && !Array.isArray(user)
    && Object.prototype.hasOwnProperty.call(user, key)
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

function Chevron(props: { open: boolean }): ReactNode {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden="true"
      style={{
        flex: 'none',
        color: 'var(--dsw-alias-label-tertiary)',
        transform: props.open ? 'rotate(180deg)' : undefined,
        transition: 'transform .16s',
      }}
    >
      <path fill="currentColor" d="M3.2 5.2a.75.75 0 0 1 1.06 0L7 7.94l2.74-2.74a.75.75 0 1 1 1.06 1.06l-3.27 3.27a.75.75 0 0 1-1.06 0L3.2 6.26a.75.75 0 0 1 0-1.06z" />
    </svg>
  )
}

function Switch(props: { on: boolean, disabled: boolean, onToggle: () => void }): ReactNode {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.on}
      disabled={props.disabled}
      onClick={props.onToggle}
      style={{
        flex: 'none',
        width: 36,
        height: 20,
        padding: 2,
        border: 0,
        borderRadius: 999,
        cursor: props.disabled ? 'default' : 'pointer',
        background: props.on ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-border-l2)',
        opacity: props.disabled ? 0.4 : 1,
      }}
    >
      <span style={{
        display: 'block',
        width: 16,
        height: 16,
        borderRadius: 999,
        background: 'var(--dsw-alias-bg-layer-3)',
        transform: props.on ? 'translateX(16px)' : 'translateX(0)',
        transition: 'transform .16s',
      }}
      />
    </button>
  )
}

function Override(props: {
  show: boolean
  disabled: boolean
  overridden: string
  reset: string
  onReset: () => void
}): ReactNode {
  if (!props.show) return null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={badge}>{props.overridden}</span>
      <button type="button" style={resetBtn} disabled={props.disabled} onClick={props.onReset}>
        {props.reset}
      </button>
    </span>
  )
}

/** Official-shaped plugin card: collapsed chrome, staged knobs, file editor. */
export function MemoryCard(props: MemoryCardProps): ReactNode {
  const t = props.t ?? ((key: MemoryLocaleKey) => en[key])
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const [status, setStatus] = useState<Status>()
  const [active, setActive] = useState<FileId>('memory')
  const [draft, setDraft] = useState('')
  const [hash, setHash] = useState('')
  const [info, setInfo] = useState<FileContent>()
  const [note, setNote] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [knobDraft, setKnobDraft] = useState<Draft>({})
  const [numberText, setNumberText] = useState<Partial<Record<KnobKey, string>>>({})
  const settings = useSettings(props.scope)
  const knobs = settings.value
  const disabled = !settings.writable || settings.status !== 'ready' || knobs === undefined
  const dirty = Object.keys(knobDraft).length > 0
  const invalidNumbers = NUMBERS.some(item => {
    if (!(item.field in knobDraft)) return false
    const raw = numberText[item.field]
    if (raw === undefined || raw === '') return false
    const next = Number(raw)
    return !Number.isFinite(next) || next < item.min
  })

  const resolved = <K extends KnobKey>(field: K): MemoryPanelSettings[K] => {
    return Object.prototype.hasOwnProperty.call(knobDraft, field)
      ? knobDraft[field]
      : knobs?.[field]
  }

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
    if (!open) return
    void reloadStatus().then(() => loadFile(active)).catch((error: unknown) => {
      setNote(error instanceof Error ? error.message : String(error))
    })
  }, [active, loadFile, open, reloadStatus])

  const saveFile = async () => {
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
      setNote(t('savedNextTurn'))
      await reloadStatus()
    } catch (error) {
      setNote(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const saveKnobs = async () => {
    if (props.scope === undefined || invalidNumbers) return
    setSaving(true)
    setFailed(false)
    try {
      for (const [field, value] of Object.entries(knobDraft) as [KnobKey, MemoryPanelSettings[KnobKey] | undefined][]) {
        if (value === undefined) await props.scope.unset(field)
        else await props.scope.set(field, value)
      }
      setKnobDraft({})
      setNumberText({})
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  const hostLine = status === undefined
    ? t('loading')
    : `${status.host?.version ?? '—'} · plugin ${status.pluginVersion} · ${status.hostAssessment.reason}`
  const cons = status?.lastConsolidation
  const chrome: CSSProperties = {
    ...(open ? cardOpen : card),
    ...(hover && !open ? { borderColor: 'var(--dsw-alias-label-dimmed)' } : {}),
  }

  return (
    <li
      style={chrome}
      onMouseEnter={() => { setHover(true) }}
      onMouseLeave={() => { setHover(false) }}
    >
      <button
        type="button"
        style={header}
        aria-expanded={open}
        aria-label={`${t(open ? 'collapse' : 'expand')}: ${t('title')}`}
        onClick={() => { setOpen(!open) }}
      >
        <span style={headText}>
          <span style={name}>{t('title')}</span>
          <span style={description}>{t('description')}</span>
        </span>
        {dirty ? <span style={pending}>{t('unsaved')}</span> : null}
        <Chevron open={open} />
      </button>
      {open
        ? (
          <div style={body}>
            {disabled ? <p style={muted} role="status">{t('readOnly')}</p> : null}
            <div style={fieldFirst}>
              <div style={fieldHead}><span style={label}>{t('status')}</span></div>
              <p style={hint}>{hostLine}</p>
              <p style={hint}>{t('home')}：{status?.home ?? '—'}</p>
              <p style={hint}>
                {t('recallIndex')}：{status?.sessionQuery.exists ? `${status.sessionQuery.bytes} bytes` : t('recallMissing')}
              </p>
              <p style={hint}>
                {t('lastConsolidation')}：{cons ? `${cons.status ?? 'unknown'} · ${cons.updatedAt ?? cons.sessionId}` : t('none')}
              </p>
            </div>
            <div style={field}>
              <div style={fieldHead}><span style={label}>{t('filesTitle')}</span></div>
              <p style={hint}>{t('filesHint')}</p>
              <div role="tablist" aria-label={t('filesTitle')} style={tabs}>
                {FILES.map(file => {
                  const selected = file.id === active
                  const missing = status?.files.find(item => item.id === file.id)?.exists === false
                  return (
                    <button
                      key={file.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      data-active={selected ? 'true' : 'false'}
                      style={{
                        ...tabBase,
                        color: selected
                          ? 'var(--dsw-alias-label-primary)'
                          : 'var(--dsw-alias-label-tertiary)',
                        boxShadow: selected
                          ? 'inset 0 -2px 0 var(--dsw-alias-label-primary)'
                          : 'inset 0 -2px 0 transparent',
                      }}
                      onClick={() => {
                        if (file.id !== active) setActive(file.id)
                      }}
                    >
                      {file.label}
                      {missing ? ` · ${t('missing')}` : ''}
                    </button>
                  )
                })}
              </div>
              <p style={hint}>
                {info?.path ?? ''}
                {info?.managed === 'malformed' ? ` · ${t('malformed')}` : ''}
                {info ? ` · ${info.chars} chars` : ''}
              </p>
              <textarea
                style={area}
                value={draft}
                onChange={event => { setDraft(event.target.value) }}
                spellCheck={false}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" style={discard} disabled={busy} onClick={() => { void saveFile() }}>
                  {t('saveFile')}
                </button>
                <button type="button" style={discard} disabled={busy} onClick={() => { void loadFile(active) }}>
                  {t('reload')}
                </button>
              </div>
              {note ? <p style={hint}>{note}</p> : null}
            </div>
            <div style={field}>
              <div style={fieldHead}><span style={label}>{t('knobsTitle')}</span></div>
              <p style={hint}>{t('knobsHint')}</p>
              {settings.status === 'unavailable' || (settings.status === 'ready' && knobs === undefined)
                ? <p style={invalid}>{t('settingsUnavailable')}</p>
                : null}
            </div>
            {FLAGS.map(item => {
              const on = Boolean(resolved(item.field))
              return (
                <div key={item.field} style={field}>
                  <div style={fieldHead}>
                    <span style={label}>{t(item.label)}</span>
                    <Override
                      show={fieldOverridden(settings.user, item.field) || item.field in knobDraft}
                      disabled={disabled}
                      overridden={t('overridden')}
                      reset={t('reset')}
                      onReset={() => {
                        setKnobDraft(current => ({ ...current, [item.field]: undefined }))
                      }}
                    />
                    <Switch
                      on={on}
                      disabled={disabled}
                      onToggle={() => {
                        setKnobDraft(current => ({ ...current, [item.field]: !on }))
                      }}
                    />
                  </div>
                  <p style={hint}>{t(item.hint)}</p>
                </div>
              )
            })}
            <div style={field}>
              <div style={fieldHead}>
                <span style={label}>{t('mode')}</span>
                <Override
                  show={fieldOverridden(settings.user, 'consolidationMode') || 'consolidationMode' in knobDraft}
                  disabled={disabled}
                  overridden={t('overridden')}
                  reset={t('reset')}
                  onReset={() => {
                    setKnobDraft(current => ({ ...current, consolidationMode: undefined }))
                  }}
                />
              </div>
              <select
                style={input}
                disabled={disabled}
                value={resolved('consolidationMode') ?? 'automatic'}
                onChange={event => {
                  setKnobDraft(current => ({
                    ...current,
                    consolidationMode: event.target.value as 'automatic' | 'proposal',
                  }))
                }}
              >
                <option value="automatic">{t('modeAutomatic')}</option>
                <option value="proposal">{t('modeProposal')}</option>
              </select>
              <p style={hint}>{t('modeHint')}</p>
            </div>
            {NUMBERS.map(item => {
              const value = resolved(item.field)
              const text = numberText[item.field] ?? (typeof value === 'number' ? String(value) : '')
              const bad = item.field in knobDraft && text !== '' && (!Number.isFinite(Number(text)) || Number(text) < item.min)
              return (
                <div key={item.field} style={field}>
                  <div style={fieldHead}>
                    <label style={label} htmlFor={`memory-${item.field}`}>{t(item.label)}</label>
                    <Override
                      show={fieldOverridden(settings.user, item.field) || item.field in knobDraft}
                      disabled={disabled}
                      overridden={t('overridden')}
                      reset={t('reset')}
                      onReset={() => {
                        setKnobDraft(current => ({ ...current, [item.field]: undefined }))
                        setNumberText(current => {
                          const next = { ...current }
                          delete next[item.field]
                          return next
                        })
                      }}
                    />
                  </div>
                  <input
                    id={`memory-${item.field}`}
                    style={bad ? { ...input, borderColor: 'var(--dsw-alias-label-error)' } : input}
                    inputMode="numeric"
                    disabled={disabled}
                    value={text}
                    onChange={event => {
                      const raw = event.target.value
                      setNumberText(current => ({ ...current, [item.field]: raw }))
                      if (raw === '') {
                        setKnobDraft(current => ({ ...current, [item.field]: undefined }))
                        return
                      }
                      const next = Number(raw)
                      if (Number.isFinite(next) && next >= item.min) {
                        setKnobDraft(current => ({ ...current, [item.field]: Math.floor(next) }))
                      } else {
                        setKnobDraft(current => ({ ...current, [item.field]: knobs?.[item.field] }))
                      }
                    }}
                  />
                  <p style={bad ? invalid : hint}>{bad ? t('invalidNumber') : t(item.hint)}</p>
                </div>
              )
            })}
            <div style={footer}>
              {failed ? <p style={{ ...invalid, flex: 1, minWidth: 0 }} role="status">{t('saveFailed')}</p> : null}
              <button
                type="button"
                style={{ ...discard, opacity: !dirty || saving ? 0.4 : 1, cursor: !dirty || saving ? 'default' : 'pointer' }}
                disabled={!dirty || saving}
                onClick={() => {
                  setKnobDraft({})
                  setNumberText({})
                  setFailed(false)
                }}
              >
                {t('discard')}
              </button>
              <button
                type="button"
                style={{ ...save, opacity: !dirty || invalidNumbers || saving ? 0.4 : 1, cursor: !dirty || invalidNumbers || saving ? 'default' : 'pointer' }}
                disabled={!dirty || invalidNumbers || saving}
                onClick={() => { void saveKnobs() }}
              >
                {t(saving ? 'saving' : 'save')}
              </button>
            </div>
          </div>
        )
        : null}
    </li>
  )
}
