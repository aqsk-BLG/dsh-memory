# dsh-file-memory

[![banner](docs/assets/banner.png)](https://www.npmjs.com/package/dsh-file-memory)

[English](README.md) | 中文

可安装到 DSH profile 的 WorkBuddy 风格分层记忆 bundle：全局人格与记忆文件、显式绑定工作区的实时记忆、可跳过提醒与后台整理、混合会话回忆、压缩后 flush，以及随包分发的使用 skill（技能）。本仓库是 DeepSeek Harness 源码实现的独立 Git 发行版。自 v1.2.1 起，包名发布为 `dsh-file-memory`。

## 安装或移除

预期用户已经从[官方 DeepSeek Harness 仓库](https://github.com/deepseek-ai/deepseek-harness)拉取源码并运行过 DSH，可能已经有聊天、模型／provider 设置、工作区和 `web` profile。先停止正在运行的 DSH，然后在同一份源码根目录、并确保命令继承启动 DSH 时使用的同一个 `DSH_HOME`，执行：

```sh
pnpm dsh plugin --profile web add github:aqsk-BLG/dsh-memory#v1.3.0
pnpm dsh --profile web --dump-config
pnpm dsh web
```

若希望跟随仓库最新提交，可去掉 `#v1.3.0`；最严格的可复现部署则应把标签换成具体 commit SHA。全局安装了 CLI 的用户可以把 `pnpm dsh ...` 换成 `dsh ...`。

发布到 npm 后，注册表包名为 `dsh-file-memory`：

```sh
pnpm dsh plugin --profile web add dsh-file-memory
```

也可以从 Release 产物安装：先在 [v1.3.0 release](https://github.com/aqsk-BLG/dsh-memory/releases/tag/v1.3.0) 的 assets 下载 `dsh-file-memory-1.3.0.tgz`，然后：

```sh
pnpm dsh plugin --profile web add ./dsh-file-memory-1.3.0.tgz
```

> **命名说明。**自 v1.2.1 起本包以 **`dsh-file-memory`** 发布。npm 上的 `dsh-memory` 是另一个无关的包——请勿误装。

`dsh plugin` 只更新现有 profile 的依赖元数据、锁文件、已安装模块和 `dsh.profile.bundles` 列表。它不会修改 DSH 源码，不会另建智能体或工作区，也不会重置已有会话、模型、设置、存储或工作区注册。bundle 同样不会设置 `dshHome`，因此插件与当前 DSH 实例始终使用同一个数据根：优先继承 `$DSH_HOME`；仅当该变量未设置时，才与 DSH 一起使用其默认的 `~/.dsh`。它不会同时打开两个根目录。

bundle 会插入 `memory` 行，并在 `$DSH_HOME/session-query.sqlite` 启用会话查询索引；后续 profile 与 home patch 仍可覆盖这两行。仓库已提交构建好的 `lib/index.js` 与 `lib/client.js`，安装时无需运行依赖生命周期构建。卸载依赖和配置层后重启 DSH：

```sh
pnpm dsh plugin --profile web remove dsh-file-memory
```

公开仓库可从 GitHub 的 [`dsh-plugin` topic](https://github.com/topics/dsh-plugin)发现。

## 宿主版本支持

加载时 facade 会把 DeepSeek Harness 的发布版本与支持下限做比对。版本来源：与插件安装在同一处的 `@deepseek-ai/*` 包清单（官方发布全部同版本号，如 `0.1.0-rc.7`），或显式的 `DSH_VERSION` 环境变量。

- **测试下限：`0.1.0-rc.7`。**本插件用到的全部 peer API（`agent/created`、system-prompt section、工作区注册表、session-query 注入、压缩后 flush）都在该版本上验证过。
- **等于或高于下限**——只打一行 info 日志，无其他影响。
- **低于下限**——facade 拒绝加载，报错会同时写明检测到的版本与要求的版本。只有维护兼容 fork 时才可降到 `versionGate: 'warn'`（或 `'off'` 关闭）。
- **版本无法检测或无法解析**——仅警告并继续运行。未知版本不能证明不兼容，因此隐藏版本号绝不会导致插件崩溃。

## 首次运行

当 `$DSH_HOME` 下还没有 `USER.md`、`MEMORY.md`、`IDENTITY.md` 或 `SOUL.md` 时，插件会以独占创建方式写入简短的起始模板：纯 Markdown、无 `<!-- -->` 注释，并说明每个文件的作用。已有文件绝不覆盖、重命名或重排格式，已有会话也绝不改写。首次运行不强制任何其他操作：不建记忆索引、不整理历史、不写其他文件，只有那四个小文件，加上首次搜索时才懒加载打开的 `session-query.sqlite` 索引。可用 `seedMissingPersonaFiles` / `seedMissingMemoryFiles` 关闭模板初始化。

## 与其他插件、模型共存

- **轻量 cordis patch。**bundle 的 `cordis.patch.yml` 只插入 `memory` 行和 `session-query-sqlite` 行（首次搜索时才在 `$DSH_HOME/session-query.sqlite` 懒加载打开）。后续 profile 与 home patch 仍然生效并可覆盖这两行；移除依赖即移除两者。
- **不写自定义会话事件。**自 v1.1.0 起插件不再追加官方目录外的事件，原版 harness 不会拒绝其会话，其他插件的事件处理也不受影响。
- **其他插件行不受干扰。**facade 只注册 `memory` 一个名字和 `skills` 注入；内部部件使用带前缀的名字（`persona-files`、`memory-bootstrap`、`tool-session-search`、`memory-flush`、`memory-consolidator`）。项目或 preset 可用同名 skill 覆盖随包的 `memory` skill。
- **共享模型路由。**语义回忆与后台整理默认复用当前会话的模型路由；专用 `semanticProvider`/`semanticModel` 与 `consolidationProvider`/`consolidationModel` 均可选，且不会改动其他插件的路由。关闭 `semanticEnabled` 后回忆完全本地化、仅全文检索。
- **不产生第二个数据根。**bundle 不设置 `dshHome`，始终与宿主 DSH 实例使用同一个 home。

## 从 v1.0.x 迁移

v1.0.x 会写入四个自定义会话事件（`memory/bootstrap`、`persona/bootstrap`、`memory/consolidation-request`、`memory/consolidation-result`）。v1.1.0 已改为文件化状态，v1.2.0 沿用该模型。升级步骤：

1. 停止 DSH。
2. 安装新标签（`github:aqsk-BLG/dsh-memory#v1.3.0`）；若暂不升级插件，也可只执行下面的旧事件清理。
3. 旧事件被标记为可忽略或删除前，原版 harness 无法重新打开 v1.0.x 日志。停止 DSH 后执行：

   ```sh
   node scripts/migrate-legacy-events.mjs "$DSH_HOME/sessions" --apply
   ```

   Zstandard 压缩日志需要 harness 源码提供其内部编解码器：追加 `--harness-source <deepseek-harness 源码路径>`。默认 dry-run 只报告将要修改的内容；每个被重写的日志旁会留下备份。
4. 首次加载时，插件会把尚存的旧 `memory/consolidation-result`/`-request` 事件折叠进全新的每会话巩固状态文件 `$DSH_HOME/memory/consolidation/<session-id>.json`（安全：序号稳定、每日追加按标记幂等、未变更受管区块重写为 noop），此后只写文件。
5. 启动 DSH，确认日志中出现了报告检测到宿主版本的那一行。

完整状态布局见[持久化模型](#持久化模型)。

## 功能

挂载 bundle 即组合五项内置能力与手册：

- **人格文件**：初始化并注入冻结的 `$DSH_HOME/IDENTITY.md` 与 `$DSH_HOME/SOUL.md` 快照。
- **记忆 bootstrap**：注入冻结的全局 `USER.md` 与 `MEMORY.md`、实时项目 `MEMORY.md`，以及轻量每轮提醒；提醒会跳过问候、简单查询和短问答。
- **后台记忆巩固器**：每个有效任务完成并进入空闲态后立即审核，通过冲突检查写入有界受管区块，并且只为仍然绑定的工作区幂等追加每日日志。问候和短问答会跳过；更大的批处理节奏仍可作为可选成本控制。破坏性重写被守卫拦截时，会保留旧条目并写入预算内的安全新增项；可重试的混合结果不会推进水位线，畸形受管区等待修复，瞬时失败采用退避。水位线与重试控制基于文件持久化（见下方“持久化模型”）。
- **混合会话搜索**：有模型路由时对有界既往会话 surface 进行语义排序，大型锦标赛允许合法空分片，并提供明确标注的全文回退。
- **压缩后 flush**：压缩后排入提醒，把重要上下文写入当前允许的记忆层。
- **设置卡**：挂在官方 `memory` 命名空间的插件配置卡（状态、四个核心文件、常用开关）。文件保存立刻落盘；开关写入官方设置文档，下次启动 DSH 生效。
- 随包的 `memory` runtime skill：说明文件职责、该记录和跳过什么、仅追加每日日志、语义回忆与 30 天蒸馏规则。项目或 preset 可用同名 skill 覆盖它。

独立构建会把五项能力编译进同一个 `lib/index.js`，运行时只把 DSH 主程序包作为 peer。人格文件在内部仍是独立身份关注点，只是 facade 将它与记忆一并安装。

## 持久化模型

自 v1.1.0 起，本插件**不再写入任何自定义会话事件**。官方 DeepSeek Harness 构建会拒绝解释包含目录外事件类型的会话日志——除非该事件携带 `ignorable` 信封标记（SessionFormatUnsupportedError），而 `Session.append` 无法设置该标记——因此持久化状态绝不能依赖自定义目录事件。本插件从不追加 `memory/bootstrap`、`persona/bootstrap`、`memory/consolidation-request` 或 `memory/consolidation-result`，纯官方 DSH 上的社区用户不会再遇到该拒绝。

文件化状态位于当前 DSH 数据根下：

- `$DSH_HOME/memory/consolidation/<session-id>.json` — 每个会话的巩固状态：持久水位线（被推进性审核完全覆盖的最高轮次 `endSeq`）、最近一次审核结果（状态、各目标结果、重试控制、错误）以及最近一次已准备审核请求的紧凑记录。每次审核后原子写入；只有状态允许推进的结果才会推进水位线，因此部分失败会像 v1.0.x 事件日志一样保留批次受控重试。
- `$DSH_HOME/USER.md`、`$DSH_HOME/MEMORY.md`、`$DSH_HOME/IDENTITY.md`、`$DSH_HOME/SOUL.md` — 与现在完全相同，记忆文件内的受管区块行为不变。

v1.0.x 写入的会话仍带有旧事件。当宿主 harness 能解码它们时（例如带旧词汇的补丁构建），插件会在首次加载时把最后的旧 result/request 事件折叠进新状态文件，此后只写文件。由于序号稳定、每日追加按标记幂等、受管区块对未变更条目重写为 noop，重建水位线是安全的。

v1.0.x 写入的日志在把旧事件标记为可忽略或删除前，无法被原版 harness 重新打开。停止 DSH 后执行：

```sh
node scripts/migrate-legacy-events.mjs "$DSH_HOME/sessions" --apply
```

Zstandard 压缩日志需要 harness 源码提供其内部编解码器：追加 `--harness-source <deepseek-harness 源码路径>`。默认 dry-run 只报告将要修改的内容；每个被重写的日志旁会留下备份。

## 工作区权威

只有会话被显式挂到已注册工作区时，项目记忆才存在。每次组装提示词时，bootstrap 都用当前 session id 查询 `ctx.workspaceRegistry.list()`，并发布实时 `MEMORY SCOPE`，其中包含精确项目记忆目录与有界 `.dsh/memory/MEMORY.md` 内容。带日期的 `.dsh/memory/YYYY-MM-DD.md` 日志仍按需读取。

没有匹配归属的会话——包括 Web UI 的“未分组”——只使用全局记忆和会话回忆。插件绝不从 `cwd` 推断归属，绝不扫描全部工作区，绝不自动注册源码仓库；移除工作区注册也绝不删除项目记忆文件。

## 配置

| 键 | 默认值 | 含义 |
|---|---|---|
| `dshHome` | 不设置 | 仅供高级显式覆盖。通常必须留空，使插件沿用 DSH 已选择的同一个根：优先 `$DSH_HOME`，否则才是 DSH 默认的 `~/.dsh` |
| `versionGate` | `error` | 加载时的宿主版本门：`error` 在低于 `0.1.0-rc.7` 的宿主上大声失败，`warn` 只记日志，`off` 关闭检查 |
| `memoryBudgetChars` | `4000` | 全局 `MEMORY.md` 的码点预算 |
| `userBudgetChars` | `1500` | 全局 `USER.md` 的码点预算 |
| `projectMemoryBudgetChars` | `3000` | 实时项目 `MEMORY.md` 的码点预算 |
| `reminderEnabled` | `true` | 包含可跳过的每轮记忆提醒 |
| `memorySectionOrder` | `5` | 冻结全局记忆提示词顺序 |
| `identityBudgetChars` | `4000` | `IDENTITY.md` 的码点预算 |
| `soulBudgetChars` | `4000` | `SOUL.md` 的码点预算 |
| `seedMissingPersonaFiles` | `true` | 人格文件缺失时初始化保守默认内容 |
| `seedMissingMemoryFiles` | `true` | `USER.md`/`MEMORY.md` 缺失时初始化简短模板；绝不覆盖 |
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
| `consolidationEveryEligibleTurns` | `1` | 普通单批审核包含的有效完成任务数；仅需批处理时才调高 |
| `consolidationMinUserChars` | `12` | 非工具轮次的最少人类码点数 |
| `consolidationMinAssistantChars` | `24` | 非工具轮次的最少 assistant 码点数 |
| `consolidationMaxTurnsPerReview` | `20` | 单次审核最多包含的有效轮次数 |
| `consolidationTranscriptBudgetChars` | `12000` | 有界审核 transcript 文本 |
| `consolidationDailyBudgetChars` | `1200` | 每次审核的每日追加预算 |
| `consolidationMaxTokens` | 不设置 | 仅供高级路由覆盖；通常留空，由所选模型适配器提供原生输出上限 |
| `consolidationReasoningEffort` | 不设置 | 同一路由通常继承当前会话推理档位；专用路由则采用其适配器默认值 |
| `consolidationTimeoutMs` | `180000` | 后台审核端到端截止时间（毫秒） |
| `consolidationMaxDeletionRatio` | `0.5` | 超过比例的自动受管条目删除转为 proposal；除非用户明确要求，否则清空始终受保护 |
| `consolidationRetryBaseDelayMs` | `60000` | 瞬时失败的初始重试间隔 |
| `consolidationRetryMaxDelayMs` | `3600000` | 瞬时失败的最大重试间隔 |
| `consolidationProvider` | `""` | 可选专用审核 provider，需与 `consolidationModel` 成对 |
| `consolidationModel` | `""` | 可选专用审核模型，需与 `consolidationProvider` 成对 |

若使用原始 Cordis 组合而非 profile bundle：

```yaml
- name: dsh-file-memory
  config:
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

人格与全局快照在每次请求中占用有界提示词 token。实时作用域只在获授权时增加有界项目快照与短提醒。每日日志与完整 skill 只有被读取时才增加 token。语义回忆只在调用工具时发起独立的有界模型请求。后台整理默认在每个有效任务完成并进入空闲态后发起一次辅助调用，问候和短问答会先被过滤。审核器保留所选路由的推理能力，只返回增量 `add`／精确 `remove` 补丁及新的每日记录。插件默认不再另设固定输出 token 上限：模型适配器的原生路由上限只是传输边界，真正授权写入的是 `USER.md`、全局／项目 `MEMORY.md` 与每日追加的字符预算。可见 JSON 的异常膨胀保护也完全由这些文件预算推导，不计算隐藏推理。每批成功后，只要智能体仍为空闲，就会继续调度下一批积压任务，避免把旧任务塞进一次超大审核。希望减少调用的使用者可以调高 `consolidationEveryEligibleTurns`，但明确的记住或忘记请求仍会绕过批处理。

#### KV Cache 影响

人格与全局 section 在会话内冻结，前缀稳定。工作区归属、项目长期记忆与提醒通过动态运行时上下文通道传递。工具调用与已加载 skill 内容追加在可复用前缀之后。

## 运行要求与来源

- DeepSeek Harness `>= 0.1.0-rc.7`（在 `0.1.0-rc.7` 上测试），由它提供声明的 `@deepseek-ai/*` peer 包。更旧的宿主默认会被加载期版本门拦下；详见[宿主版本支持](#宿主版本支持)。
- Node `^22.19.0 || >=24`。
- CI 在 Node 22 与 24 上对每次 push 与 PR 运行 `pnpm check`（类型检查、bundle 构建与各策略检查脚本）。

本包是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 中 `packages/memory/*` 与 `packages/identity/persona-files` 的独立发行版，采用 MIT 许可证。详情见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 设置卡

打开 **设置 → 插件 → 插件配置**。卡片中英双语，做三件事：

- **状态**：宿主版本、插件版本、`$DSH_HOME`、召回索引、最近巩固状态。
- **核心文件**：查看并编辑 `IDENTITY.md` / `SOUL.md` / `USER.md` / `MEMORY.md`。USER/MEMORY 保存会拒绝坏掉的 consolidator 受管区，也拒绝过期哈希。
- **常用开关**：提醒、语义召回、全文回退、flush、巩固、模式、节奏、三个记忆预算。立刻写入官方设置文档，下次启动 DSH 生效。更细的字段仍改 `cordis.patch.yml`。

这张卡与 Agent 预设不冲突。预设改 `agent.cordis.yml`；这张卡改人格/记忆文件和 `memory` 设置命名空间。

## 已知限制与暂缓工作

- **开关需要重启才生效**：卡片通过官方设置文档落盘，但 v1 不会热重挂五个能力部件。
- **每会话冻结 home 文件**：对 `IDENTITY.md`、`SOUL.md`、`USER.md` 或全局 `MEMORY.md` 的编辑，只会在新会话进入已有模型上下文（v1.0.x 额外写每会话快照事件；v1.1.0 直接读文件，恢复的会话会重新快照当前文件）。
- **不注入每日日志**：即使项目长期记忆保持实时，带日期的项目历史仍按需读取。
- **尚无历史每日日志蒸馏**：后台整理器审核新完成的轮次；30 天每日日志蒸馏仍是手动维护规则。
- **Proposal 模式仅供检查**：没有稍后 approve／apply 的命令或 UI。
- **删除保护产生的 proposal 需人工处理**：automatic 模式会写入预算内的安全新增项，同时保留被保护的旧条目；物化后的候选列表与目标结果保存在巩固状态文件中。若“保留旧条目＋全部新增项”会超过目标预算，则不写文件，proposal 仅供检查。
- **语义候选对 provider 可见**：语义回忆会把有界既往会话片段发送给所选模型 provider；若只需本地全文回忆，请关闭该功能。
- **没有跨设备语料或云同步**：会话发现与全文回退使用已组合的 DSH session-query 存储；云同步仍是可选未来层。

## 许可证

[MIT](LICENSE)
