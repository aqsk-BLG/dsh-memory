/** Locale keys for the Plugins-tab memory card. */
export type MemoryLocaleKey =
  | 'title' | 'description' | 'expand' | 'collapse'
  | 'unsaved' | 'save' | 'saving' | 'discard' | 'saveFailed' | 'readOnly'
  | 'overridden' | 'reset' | 'invalidNumber'
  | 'status' | 'home' | 'recallIndex' | 'recallMissing' | 'lastConsolidation' | 'none' | 'loading'
  | 'filesTitle' | 'filesHint' | 'saveFile' | 'reload' | 'missing' | 'malformed' | 'savedNextTurn'
  | 'knobsTitle' | 'knobsHint' | 'settingsUnavailable'
  | 'reminder' | 'reminderHint'
  | 'semantic' | 'semanticHint'
  | 'fallback' | 'fallbackHint'
  | 'flush' | 'flushHint'
  | 'consolidation' | 'consolidationHint'
  | 'mode' | 'modeHint' | 'modeAutomatic' | 'modeProposal'
  | 'cadence' | 'cadenceHint'
  | 'memoryBudget' | 'memoryBudgetHint'
  | 'userBudget' | 'userBudgetHint'
  | 'projectBudget' | 'projectBudgetHint'

/** English copy. One line per official card field. */
export const en: Record<MemoryLocaleKey, string> = {
  title: 'File memory',
  description: 'Layered file memory. Edit USER, MEMORY, IDENTITY, and SOUL.',
  expand: 'Show settings',
  collapse: 'Hide settings',
  unsaved: 'Unsaved',
  save: 'Save',
  saving: 'Saving…',
  discard: 'Discard',
  saveFailed: 'The deployment did not accept these values; they were left for you to correct.',
  readOnly: 'This deployment stores settings read-only.',
  overridden: 'Overridden',
  reset: 'Reset to default',
  invalidNumber: 'Enter a number, or leave blank to use the default.',
  status: 'Status',
  home: 'Home',
  recallIndex: 'Recall index',
  recallMissing: 'Not built yet',
  lastConsolidation: 'Last consolidation',
  none: 'None yet',
  loading: 'Loading…',
  filesTitle: 'Core files',
  filesHint: 'USER and MEMORY saves validate the consolidator managed region.',
  saveFile: 'Save file',
  reload: 'Reload',
  missing: 'Missing',
  malformed: 'Managed region is malformed',
  savedNextTurn: 'Saved. The next session turn picks this up.',
  knobsTitle: 'Common knobs',
  knobsHint: 'Saved to the official settings document. Takes effect on the next DSH start.',
  settingsUnavailable: 'Settings scope is unavailable. Edit cordis.patch.yml instead.',
  reminder: 'Turn reminder',
  reminderHint: 'A short memory reminder on every eligible turn.',
  semantic: 'Semantic recall',
  semanticHint: 'Rank past sessions with the current model route.',
  fallback: 'Full-text fallback',
  fallbackHint: 'Fall back to full-text search when semantic ranking cannot run.',
  flush: 'Compaction flush',
  flushHint: 'Queue a memory flush after a successful compaction.',
  consolidation: 'Background consolidation',
  consolidationHint: 'Review completed turns and update the managed memory region.',
  mode: 'Consolidation mode',
  modeHint: 'Write approved changes, or keep them as inspect-only proposals.',
  modeAutomatic: 'automatic',
  modeProposal: 'proposal',
  cadence: 'Consolidate every N eligible turns',
  cadenceHint: 'Skip-aware cadence. 1 reviews every completed turn.',
  memoryBudget: 'MEMORY budget (chars)',
  memoryBudgetHint: 'Code-point budget for the injected MEMORY.md snapshot.',
  userBudget: 'USER budget (chars)',
  userBudgetHint: 'Code-point budget for the injected USER.md snapshot.',
  projectBudget: 'Project MEMORY budget (chars)',
  projectBudgetHint: 'Code-point budget for the live workspace MEMORY.md.',
}

/** Simplified Chinese copy. Matches official plugin-card tone. */
export const zh: Record<MemoryLocaleKey, string> = {
  title: '文件记忆',
  description: '分层文件记忆。可编辑 USER / MEMORY / IDENTITY / SOUL。',
  expand: '展开设置',
  collapse: '收起设置',
  unsaved: '未保存',
  save: '保存',
  saving: '保存中…',
  discard: '放弃修改',
  saveFailed: '本部署没有接受这些值，已保留供你修改。',
  readOnly: '本部署的设置为只读。',
  overridden: '已覆盖',
  reset: '恢复默认',
  invalidNumber: '请填数字；留空表示使用默认值。',
  status: '状态',
  home: 'Home',
  recallIndex: '召回索引',
  recallMissing: '尚未建立',
  lastConsolidation: '最近巩固',
  none: '还没有',
  loading: '读取中…',
  filesTitle: '核心文件',
  filesHint: '保存 USER / MEMORY 时会校验 consolidator 受管区。',
  saveFile: '保存文件',
  reload: '重新加载',
  missing: '缺失',
  malformed: '受管区损坏',
  savedNextTurn: '已保存。下一轮会话才会注入提示词。',
  knobsTitle: '常用开关',
  knobsHint: '写入官方设置文档，下次启动 DSH 才生效。',
  settingsUnavailable: '设置通道不可用。请改 cordis.patch.yml。',
  reminder: '每轮提醒',
  reminderHint: '每个合格轮次附带一条简短记忆提醒。',
  semantic: '语义召回',
  semanticHint: '用当前模型路由给历史会话排序。',
  fallback: '全文回退',
  fallbackHint: '语义排序跑不起来时退回全文检索。',
  flush: '压缩后冲刷',
  flushHint: '压缩成功后排队冲刷记忆。',
  consolidation: '后台巩固',
  consolidationHint: '回顾已完成轮次，更新受管记忆区。',
  mode: '巩固模式',
  modeHint: '直接写入，或只留下待检查的提案。',
  modeAutomatic: '自动写入',
  modeProposal: '只提案',
  cadence: '每 N 个合格轮次巩固一次',
  cadenceHint: '跳过感知的节奏。填 1 表示每个完成轮次都回顾。',
  memoryBudget: 'MEMORY 预算（字符）',
  memoryBudgetHint: '注入 MEMORY.md 快照的码点上限。',
  userBudget: 'USER 预算（字符）',
  userBudgetHint: '注入 USER.md 快照的码点上限。',
  projectBudget: '项目 MEMORY 预算（字符）',
  projectBudgetHint: '工作区 MEMORY.md 的码点上限。',
}
