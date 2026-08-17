# dsh-memory

[English](README.md) | 中文

可安装到 DSH profile 的 WorkBuddy 风格分层记忆 bundle：全局人格与记忆文件、显式绑定工作区的实时记忆、可跳过提醒与后台整理、混合会话回忆、压缩后 flush，以及随包分发的使用 skill（技能）。本仓库是 DeepSeek Harness 源码实现的独立 Git 发行版。

## 安装或移除

把 Git bundle 安装到 profile：

```sh
dsh plugin --profile web add github:aqsk-BLG/dsh-memory
```

需要可复现部署时固定到具体 commit：

```sh
dsh plugin --profile web add github:aqsk-BLG/dsh-memory#<commit>
```

`dsh plugin` 会记录依赖，并把本包追加到 profile 的 `dsh.profile.bundles` 列表。bundle 插入 `memory` 行，并在 `$DSH_HOME/session-query.sqlite` 启用会话查询索引；后续 profile 与 home patch 仍可覆盖这两行。仓库已提交构建好的 `lib/index.js`，安装时无需运行依赖生命周期构建。运行 `dsh plugin --profile web remove dsh-memory` 会同时移除依赖和配置层。

## 功能

挂载 bundle 即组合五项内置能力与手册：

- **人格文件**：初始化并注入冻结的 `$DSH_HOME/IDENTITY.md` 与 `$DSH_HOME/SOUL.md` 快照，记录为 `persona/bootstrap`。
- **记忆 bootstrap**：注入冻结的全局 `USER.md` 与 `MEMORY.md`、实时项目 `MEMORY.md`，以及轻量每轮提醒；提醒会跳过问候、简单查询和短问答。
- **后台记忆巩固器**：审核已完成的实质轮次，通过冲突检查写入有界受管区块，并且只为仍然绑定的工作区幂等追加每日日志。可重试的混合结果不会推进水位线；畸形受管区等待修复，瞬时失败采用退避。
- **混合会话搜索**：有模型路由时对有界既往会话 surface 进行语义排序，大型锦标赛允许合法空分片，并提供明确标注的全文回退。
- **压缩后 flush**：压缩后排入提醒，把重要上下文写入当前允许的记忆层。
- 随包的 `memory` runtime skill：说明文件职责、该记录和跳过什么、仅追加每日日志、语义回忆与 30 天蒸馏规则。项目或 preset 可用同名 skill 覆盖它。

独立构建会把五项能力编译进同一个 `lib/index.js`，运行时只把 DSH 主程序包作为 peer。人格文件在内部仍是独立身份关注点，只是 facade 将它与记忆一并安装。

## 工作区权威

只有会话被显式挂到已注册工作区时，项目记忆才存在。每次组装提示词时，bootstrap 都用当前 session id 查询 `ctx.workspaceRegistry.list()`，并发布实时 `MEMORY SCOPE`，其中包含精确项目记忆目录与有界 `.dsh/memory/MEMORY.md` 内容。带日期的 `.dsh/memory/YYYY-MM-DD.md` 日志仍按需读取。

没有匹配归属的会话——包括 Web UI 的“未分组”——只使用全局记忆和会话回忆。插件绝不从 `cwd` 推断归属，绝不扫描全部工作区，绝不自动注册源码仓库；移除工作区注册也绝不删除项目记忆文件。

## 配置

| 键 | 默认值 | 含义 |
|---|---|---|
| `dshHome` | `$DSH_HOME` 或 `~/.dsh` | 存放人格与全局记忆文件的目录 |
| `memoryBudgetChars` | `4000` | 全局 `MEMORY.md` 的码点预算 |
| `userBudgetChars` | `1500` | 全局 `USER.md` 的码点预算 |
| `projectMemoryBudgetChars` | `3000` | 实时项目 `MEMORY.md` 的码点预算 |
| `reminderEnabled` | `true` | 包含可跳过的每轮记忆提醒 |
| `memorySectionOrder` | `5` | 冻结全局记忆提示词顺序 |
| `identityBudgetChars` | `4000` | `IDENTITY.md` 的码点预算 |
| `soulBudgetChars` | `4000` | `SOUL.md` 的码点预算 |
| `seedMissingPersonaFiles` | `true` | 人格文件缺失时初始化保守默认内容 |
| `personaSectionOrder` | `-50` | 位于部署 persona 之前的人格文件提示词顺序 |
| `maxHits` | `20` | 单次 `session_search` 最多返回的会话数 |
| `semanticEnabled` | `true` | 有模型路由时使用语义排序 |
| `semanticProvider` | `""` | 可选专用语义 provider，需与 `semanticModel` 成对 |
| `semanticModel` | `""` | 可选专用语义模型，需与 `semanticProvider` 成对 |
| `semanticBatchSize` | `30` | 每次语义排序请求的候选数 |
| `semanticCandidateChars` | `2000` | 每个既往会话保留的码点预算 |
| `semanticMaxTokens` | `2048` | 每次排序请求的输出 token 上限 |
| `semanticReadConcurrency` | `4` | 并发读取既往会话 surface 的数量 |
| `semanticFallbackEnabled` | `true` | 语义无法运行时使用并标注全文回退 |
| `flushEnabled` | `true` | 成功压缩后排入提醒 |
| `consolidationEnabled` | `true` | 在有效轮次完成后运行可跳过审核 |
| `consolidationMode` | `automatic` | 写入受控区块，或只记录 `proposal` 候选 |
| `consolidationEveryEligibleTurns` | `10` | 普通有效轮次审核节奏 |
| `consolidationMinUserChars` | `12` | 非工具轮次的最少人类码点数 |
| `consolidationMinAssistantChars` | `24` | 非工具轮次的最少 assistant 码点数 |
| `consolidationMaxTurnsPerReview` | `20` | 单次审核最多包含的有效轮次数 |
| `consolidationTranscriptBudgetChars` | `12000` | 有界审核 transcript 文本 |
| `consolidationDailyBudgetChars` | `1200` | 每次审核的完整每日 section 预算 |
| `consolidationMaxTokens` | `2048` | 审核输出 token 上限 |
| `consolidationTimeoutMs` | `60000` | 端到端审核截止时间（毫秒） |
| `consolidationMaxDeletionRatio` | `0.5` | 超过比例的自动受管条目删除转为 proposal；除非用户明确要求，否则清空始终受保护 |
| `consolidationRetryBaseDelayMs` | `60000` | 瞬时失败的初始重试间隔 |
| `consolidationRetryMaxDelayMs` | `3600000` | 瞬时失败的最大重试间隔 |
| `consolidationProvider` | `""` | 可选专用审核 provider，需与 `consolidationModel` 成对 |
| `consolidationModel` | `""` | 可选专用审核模型，需与 `consolidationProvider` 成对 |

若使用原始 Cordis 组合而非 profile bundle：

```yaml
- name: dsh-memory
  config:
    dshHome: ~
    reminderEnabled: true
    semanticEnabled: true
    flushEnabled: true
    consolidationEnabled: true
```

## 导出形态

函数／命名空间插件：导出 `name` / `inject` / `Config` / `apply`，没有 default。

## 模型体验

### 提示上下文、回忆工具与 skill 目录

#### 模型看到什么

每个会话都收到冻结的人格与全局记忆 section。每次请求还会收到实时 `MEMORY SCOPE`：要么是唯一精确工作区及其长期 `MEMORY.md`，要么明确项目记忆不可用。紧凑提醒会区分实质项目工作与问候、短问答。有效轮次结束后，独立的无工具审核模型会收到有界 transcript 与文件证据；其输出不会进入对话。`session_search` 暴露证据及真实排序模式，完整文件策略则可按需加载为 `memory` skill。

#### Token 影响

人格与全局快照在每次请求中占用有界提示词 token。实时作用域只在获授权时增加有界项目快照与短提醒。每日日志与完整 skill 只有被读取时才增加 token。语义回忆只在调用工具时发起独立的有界模型请求。后台整理默认在十个有效轮次后发起一次有界辅助调用；明确记忆请求则立即触发。

#### KV Cache 影响

人格与全局 section 在会话内冻结，前缀稳定。工作区归属、项目长期记忆与提醒通过动态运行时上下文通道传递。工具调用与已加载 skill 内容追加在可复用前缀之后。

## 运行要求与来源

- 当前版本的 DeepSeek Harness，并由它提供声明的 `@deepseek-ai/*` peer 包。
- Node `^22.19.0 || >=24`。

本包是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 中 `packages/memory/*` 与 `packages/identity/persona-files` 的独立发行版，采用 MIT 许可证。详情见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 已知限制与暂缓工作

- **每会话冻结 home 文件**：对 `IDENTITY.md`、`SOUL.md`、`USER.md` 或全局 `MEMORY.md` 的编辑，只会在新会话进入已有模型上下文。
- **不注入每日日志**：即使项目长期记忆保持实时，带日期的项目历史仍按需读取。
- **尚无历史每日日志蒸馏**：后台整理器审核新完成的轮次；30 天每日日志蒸馏仍是手动维护规则。
- **Proposal 模式仅供检查**：没有稍后 approve／apply 的命令或 UI。
- **删除保护产生的 proposal 需人工处理**：意外的大规模 complete-list 删除会保留在会话事件中，但不会自动写入文件。
- **语义候选对 provider 可见**：语义回忆会把有界既往会话片段发送给所选模型 provider；若只需本地全文回忆，请关闭该功能。
- **没有跨设备语料或云同步**：会话发现与全文回退使用已组合的 DSH session-query 存储；云同步仍是可选未来层。

## 许可证

[MIT](LICENSE)
