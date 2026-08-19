window.__ModuleLoader__.load({ id: "dsh-file-memory", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
let react = require("react");
let react_jsx_runtime = require("react/jsx-runtime");

//#region src/client/locales.ts
/** English copy. One line per official card field. */
const en = {
	title: "File memory",
	description: "Layered file memory. Edit USER, MEMORY, IDENTITY, and SOUL.",
	expand: "Show settings",
	collapse: "Hide settings",
	unsaved: "Unsaved",
	save: "Save",
	saving: "Saving…",
	discard: "Discard",
	saveFailed: "The deployment did not accept these values; they were left for you to correct.",
	readOnly: "This deployment stores settings read-only.",
	overridden: "Overridden",
	reset: "Reset to default",
	invalidNumber: "Enter a number, or leave blank to use the default.",
	status: "Status",
	home: "Home",
	recallIndex: "Recall index",
	recallMissing: "Not built yet",
	lastConsolidation: "Last consolidation",
	none: "None yet",
	loading: "Loading…",
	filesTitle: "Core files",
	filesHint: "USER and MEMORY saves validate the consolidator managed region.",
	saveFile: "Save file",
	reload: "Reload",
	missing: "Missing",
	malformed: "Managed region is malformed",
	savedNextTurn: "Saved. The next session turn picks this up.",
	knobsTitle: "Common knobs",
	knobsHint: "Saved to the official settings document. Takes effect on the next DSH start.",
	settingsUnavailable: "Settings scope is unavailable. Edit cordis.patch.yml instead.",
	reminder: "Turn reminder",
	reminderHint: "A short memory reminder on every eligible turn.",
	semantic: "Semantic recall",
	semanticHint: "Rank past sessions with the current model route.",
	fallback: "Full-text fallback",
	fallbackHint: "Fall back to full-text search when semantic ranking cannot run.",
	flush: "Compaction flush",
	flushHint: "Queue a memory flush after a successful compaction.",
	consolidation: "Background consolidation",
	consolidationHint: "Review completed turns and update the managed memory region.",
	mode: "Consolidation mode",
	modeHint: "Write approved changes, or keep them as inspect-only proposals.",
	modeAutomatic: "automatic",
	modeProposal: "proposal",
	cadence: "Consolidate every N eligible turns",
	cadenceHint: "Skip-aware cadence. 1 reviews every completed turn.",
	memoryBudget: "MEMORY budget (chars)",
	memoryBudgetHint: "Code-point budget for the injected MEMORY.md snapshot.",
	userBudget: "USER budget (chars)",
	userBudgetHint: "Code-point budget for the injected USER.md snapshot.",
	projectBudget: "Project MEMORY budget (chars)",
	projectBudgetHint: "Code-point budget for the live workspace MEMORY.md."
};
/** Simplified Chinese copy. Matches official plugin-card tone. */
const zh = {
	title: "文件记忆",
	description: "分层文件记忆。可编辑 USER / MEMORY / IDENTITY / SOUL。",
	expand: "展开设置",
	collapse: "收起设置",
	unsaved: "未保存",
	save: "保存",
	saving: "保存中…",
	discard: "放弃修改",
	saveFailed: "本部署没有接受这些值，已保留供你修改。",
	readOnly: "本部署的设置为只读。",
	overridden: "已覆盖",
	reset: "恢复默认",
	invalidNumber: "请填数字；留空表示使用默认值。",
	status: "状态",
	home: "Home",
	recallIndex: "召回索引",
	recallMissing: "尚未建立",
	lastConsolidation: "最近巩固",
	none: "还没有",
	loading: "读取中…",
	filesTitle: "核心文件",
	filesHint: "保存 USER / MEMORY 时会校验 consolidator 受管区。",
	saveFile: "保存文件",
	reload: "重新加载",
	missing: "缺失",
	malformed: "受管区损坏",
	savedNextTurn: "已保存。下一轮会话才会注入提示词。",
	knobsTitle: "常用开关",
	knobsHint: "写入官方设置文档，下次启动 DSH 才生效。",
	settingsUnavailable: "设置通道不可用。请改 cordis.patch.yml。",
	reminder: "每轮提醒",
	reminderHint: "每个合格轮次附带一条简短记忆提醒。",
	semantic: "语义召回",
	semanticHint: "用当前模型路由给历史会话排序。",
	fallback: "全文回退",
	fallbackHint: "语义排序跑不起来时退回全文检索。",
	flush: "压缩后冲刷",
	flushHint: "压缩成功后排队冲刷记忆。",
	consolidation: "后台巩固",
	consolidationHint: "回顾已完成轮次，更新受管记忆区。",
	mode: "巩固模式",
	modeHint: "直接写入，或只留下待检查的提案。",
	modeAutomatic: "自动写入",
	modeProposal: "只提案",
	cadence: "每 N 个合格轮次巩固一次",
	cadenceHint: "跳过感知的节奏。填 1 表示每个完成轮次都回顾。",
	memoryBudget: "MEMORY 预算（字符）",
	memoryBudgetHint: "注入 MEMORY.md 快照的码点上限。",
	userBudget: "USER 预算（字符）",
	userBudgetHint: "注入 USER.md 快照的码点上限。",
	projectBudget: "项目 MEMORY 预算（字符）",
	projectBudgetHint: "工作区 MEMORY.md 的码点上限。"
};

//#endregion
//#region src/client/MemoryCard.tsx
const API = "/api/plugins/dsh-file-memory";
const FILES = [
	{
		id: "identity",
		label: "IDENTITY"
	},
	{
		id: "soul",
		label: "SOUL"
	},
	{
		id: "user",
		label: "USER"
	},
	{
		id: "memory",
		label: "MEMORY"
	}
];
const FLAGS = [
	{
		field: "reminderEnabled",
		label: "reminder",
		hint: "reminderHint"
	},
	{
		field: "semanticEnabled",
		label: "semantic",
		hint: "semanticHint"
	},
	{
		field: "semanticFallbackEnabled",
		label: "fallback",
		hint: "fallbackHint"
	},
	{
		field: "flushEnabled",
		label: "flush",
		hint: "flushHint"
	},
	{
		field: "consolidationEnabled",
		label: "consolidation",
		hint: "consolidationHint"
	}
];
const NUMBERS = [
	{
		field: "consolidationEveryEligibleTurns",
		label: "cadence",
		hint: "cadenceHint",
		min: 1
	},
	{
		field: "memoryBudgetChars",
		label: "memoryBudget",
		hint: "memoryBudgetHint",
		min: 1
	},
	{
		field: "userBudgetChars",
		label: "userBudget",
		hint: "userBudgetHint",
		min: 1
	},
	{
		field: "projectMemoryBudgetChars",
		label: "projectBudget",
		hint: "projectBudgetHint",
		min: 1
	}
];
const EMPTY = {
	status: "unavailable",
	value: void 0,
	base: void 0,
	user: void 0,
	revision: void 0,
	writable: false,
	mode: "memory"
};
const card = {
	listStyle: "none",
	border: "1px solid var(--dsw-alias-border-l2)",
	borderRadius: 12,
	background: "var(--dsw-alias-bg-layer-3)",
	transition: "border-color .16s, background .16s"
};
const cardOpen = {
	...card,
	background: "var(--dsw-alias-bg-layer-2)",
	borderColor: "var(--dsw-alias-label-dimmed)"
};
const header = {
	width: "100%",
	appearance: "none",
	border: 0,
	background: "none",
	font: "inherit",
	color: "inherit",
	textAlign: "left",
	cursor: "pointer",
	display: "flex",
	alignItems: "center",
	gap: 12,
	padding: "14px 16px",
	borderRadius: 12
};
const headText = {
	flex: 1,
	minWidth: 0,
	display: "flex",
	flexDirection: "column",
	gap: 4
};
const name$1 = {
	fontSize: 15,
	fontWeight: 600,
	lineHeight: 1.4,
	color: "var(--dsw-alias-label-primary)"
};
const description = {
	fontSize: 13,
	lineHeight: 1.5,
	color: "var(--dsw-alias-label-tertiary)"
};
const pending = {
	flex: "none",
	borderRadius: 999,
	padding: "1px 8px",
	fontSize: 11,
	lineHeight: "17px",
	fontWeight: 500,
	whiteSpace: "nowrap",
	background: "var(--dsw-alias-bg-module-platform)",
	color: "var(--dsw-alias-label-secondary)"
};
const body = {
	borderTop: "1px solid var(--dsw-alias-border-l2)",
	margin: "0 16px",
	paddingBottom: 8
};
const field = {
	display: "flex",
	flexDirection: "column",
	gap: 6,
	padding: "12px 0",
	borderTop: "1px solid var(--dsw-alias-border-l2)"
};
const fieldFirst = {
	...field,
	borderTop: 0
};
const fieldHead = {
	display: "flex",
	alignItems: "center",
	gap: 8
};
const label = {
	flex: 1,
	minWidth: 0,
	fontSize: 13,
	fontWeight: 500,
	lineHeight: 1.5,
	color: "var(--dsw-alias-label-primary)"
};
const hint = {
	margin: 0,
	fontSize: 12,
	lineHeight: 1.5,
	color: "var(--dsw-alias-label-tertiary)"
};
const invalid = {
	...hint,
	color: "var(--dsw-alias-label-error)"
};
const badge = {
	borderRadius: 999,
	padding: "1px 8px",
	fontSize: 11,
	lineHeight: "17px",
	whiteSpace: "nowrap",
	fontWeight: 500,
	background: "var(--dsw-alias-bg-module-platform)",
	color: "var(--dsw-alias-label-secondary)"
};
const resetBtn = {
	border: "none",
	background: "none",
	padding: 0,
	font: "inherit",
	fontSize: 12,
	lineHeight: 1.5,
	color: "var(--dsw-alias-label-secondary)",
	cursor: "pointer"
};
const input = {
	height: 34,
	padding: "0 12px",
	border: "1px solid var(--dsw-alias-border-l2)",
	borderRadius: 8,
	background: "var(--dsw-alias-bg-layer-3)",
	font: "inherit",
	fontSize: 13,
	lineHeight: 1.5,
	color: "var(--dsw-alias-label-primary)"
};
const area = {
	...input,
	height: "auto",
	minHeight: 220,
	padding: 12,
	resize: "vertical",
	font: "12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
};
const footer = {
	display: "flex",
	alignItems: "center",
	justifyContent: "flex-end",
	gap: 8,
	padding: "12px 0 4px",
	borderTop: "1px solid var(--dsw-alias-border-l2)"
};
const discard = {
	appearance: "none",
	border: "1px solid var(--dsw-alias-border-l2)",
	borderRadius: 8,
	padding: "5px 14px",
	font: "inherit",
	fontSize: 13,
	lineHeight: 1.5,
	cursor: "pointer",
	background: "none",
	color: "var(--dsw-alias-label-secondary)"
};
const save = {
	...discard,
	borderColor: "transparent",
	background: "var(--dsw-alias-label-primary)",
	color: "var(--dsw-alias-bg-layer-3)"
};
const muted = {
	...hint,
	margin: "12px 0 0"
};
function fieldOverridden(user, key) {
	return typeof user === "object" && user !== null && !Array.isArray(user) && Object.prototype.hasOwnProperty.call(user, key);
}
function useSettings(scope) {
	return (0, react.useSyncExternalStore)((listener) => scope === void 0 ? () => {} : scope.subscribe(listener), () => scope === void 0 ? EMPTY : scope.getSnapshot(), () => scope === void 0 ? EMPTY : scope.getSnapshot());
}
async function getJson(path) {
	const res = await fetch(path);
	if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
	return await res.json();
}
function Chevron(props) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
		width: "14",
		height: "14",
		viewBox: "0 0 14 14",
		"aria-hidden": "true",
		style: {
			flex: "none",
			color: "var(--dsw-alias-label-tertiary)",
			transform: props.open ? "rotate(180deg)" : void 0,
			transition: "transform .16s"
		},
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
			fill: "currentColor",
			d: "M3.2 5.2a.75.75 0 0 1 1.06 0L7 7.94l2.74-2.74a.75.75 0 1 1 1.06 1.06l-3.27 3.27a.75.75 0 0 1-1.06 0L3.2 6.26a.75.75 0 0 1 0-1.06z"
		})
	});
}
function Switch(props) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
		type: "button",
		role: "switch",
		"aria-checked": props.on,
		disabled: props.disabled,
		onClick: props.onToggle,
		style: {
			flex: "none",
			width: 36,
			height: 20,
			padding: 2,
			border: 0,
			borderRadius: 999,
			cursor: props.disabled ? "default" : "pointer",
			background: props.on ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-border-l2)",
			opacity: props.disabled ? .4 : 1
		},
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: {
			display: "block",
			width: 16,
			height: 16,
			borderRadius: 999,
			background: "var(--dsw-alias-bg-layer-3)",
			transform: props.on ? "translateX(16px)" : "translateX(0)",
			transition: "transform .16s"
		} })
	});
}
function Override(props) {
	if (!props.show) return null;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
		style: {
			display: "inline-flex",
			alignItems: "center",
			gap: 8
		},
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			style: badge,
			children: props.overridden
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
			type: "button",
			style: resetBtn,
			disabled: props.disabled,
			onClick: props.onReset,
			children: props.reset
		})]
	});
}
/** Official-shaped plugin card: collapsed chrome, staged knobs, file editor. */
function MemoryCard(props) {
	const t = props.t ?? ((key) => en[key]);
	const [open, setOpen] = (0, react.useState)(false);
	const [hover, setHover] = (0, react.useState)(false);
	const [status, setStatus] = (0, react.useState)();
	const [active, setActive] = (0, react.useState)("memory");
	const [draft, setDraft] = (0, react.useState)("");
	const [hash, setHash] = (0, react.useState)("");
	const [info, setInfo] = (0, react.useState)();
	const [note, setNote] = (0, react.useState)();
	const [busy, setBusy] = (0, react.useState)(false);
	const [saving, setSaving] = (0, react.useState)(false);
	const [failed, setFailed] = (0, react.useState)(false);
	const [knobDraft, setKnobDraft] = (0, react.useState)({});
	const [numberText, setNumberText] = (0, react.useState)({});
	const settings = useSettings(props.scope);
	const knobs = settings.value;
	const disabled = !settings.writable || settings.status !== "ready" || knobs === void 0;
	const dirty = Object.keys(knobDraft).length > 0;
	const invalidNumbers = NUMBERS.some((item) => {
		if (!(item.field in knobDraft)) return false;
		const raw = numberText[item.field];
		if (raw === void 0 || raw === "") return false;
		const next = Number(raw);
		return !Number.isFinite(next) || next < item.min;
	});
	const resolved = (field$1) => {
		return Object.prototype.hasOwnProperty.call(knobDraft, field$1) ? knobDraft[field$1] : knobs?.[field$1];
	};
	const reloadStatus = (0, react.useCallback)(async () => {
		setStatus(await getJson(`${API}/status`));
	}, []);
	const loadFile = (0, react.useCallback)(async (id) => {
		const file = await getJson(`${API}/files/${id}`);
		setActive(id);
		setInfo(file);
		setDraft(file.content);
		setHash(file.contentHash);
		setNote(void 0);
	}, []);
	(0, react.useEffect)(() => {
		if (!open) return;
		reloadStatus().then(() => loadFile(active)).catch((error) => {
			setNote(error instanceof Error ? error.message : String(error));
		});
	}, [
		active,
		loadFile,
		open,
		reloadStatus
	]);
	const saveFile = async () => {
		setBusy(true);
		try {
			const body$1 = await (await fetch(`${API}/files/${active}`, {
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					content: draft,
					expectedHash: hash
				})
			})).json();
			if (!body$1.ok) {
				setNote(body$1.message ?? body$1.reason ?? "save failed");
				if (body$1.file) {
					setInfo(body$1.file);
					setHash(body$1.file.contentHash);
				}
				return;
			}
			if (body$1.file) {
				setInfo(body$1.file);
				setDraft(body$1.file.content);
				setHash(body$1.file.contentHash);
			}
			setNote(t("savedNextTurn"));
			await reloadStatus();
		} catch (error) {
			setNote(error instanceof Error ? error.message : String(error));
		} finally {
			setBusy(false);
		}
	};
	const saveKnobs = async () => {
		if (props.scope === void 0 || invalidNumbers) return;
		setSaving(true);
		setFailed(false);
		try {
			for (const [field$1, value] of Object.entries(knobDraft)) if (value === void 0) await props.scope.unset(field$1);
			else await props.scope.set(field$1, value);
			setKnobDraft({});
			setNumberText({});
		} catch {
			setFailed(true);
		} finally {
			setSaving(false);
		}
	};
	const hostLine = status === void 0 ? t("loading") : `${status.host?.version ?? "—"} · plugin ${status.pluginVersion} · ${status.hostAssessment.reason}`;
	const cons = status?.lastConsolidation;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
		style: {
			...open ? cardOpen : card,
			...hover && !open ? { borderColor: "var(--dsw-alias-label-dimmed)" } : {}
		},
		onMouseEnter: () => {
			setHover(true);
		},
		onMouseLeave: () => {
			setHover(false);
		},
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
			type: "button",
			style: header,
			"aria-expanded": open,
			"aria-label": `${t(open ? "collapse" : "expand")}: ${t("title")}`,
			onClick: () => {
				setOpen(!open);
			},
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					style: headText,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: name$1,
						children: t("title")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: description,
						children: t("description")
					})]
				}),
				dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: pending,
					children: t("unsaved")
				}) : null,
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Chevron, { open })
			]
		}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			style: body,
			children: [
				disabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					style: muted,
					role: "status",
					children: t("readOnly")
				}) : null,
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: fieldFirst,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: fieldHead,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: label,
								children: t("status")
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: hint,
							children: hostLine
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							style: hint,
							children: [
								t("home"),
								"：",
								status?.home ?? "—"
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							style: hint,
							children: [
								t("recallIndex"),
								"：",
								status?.sessionQuery.exists ? `${status.sessionQuery.bytes} bytes` : t("recallMissing")
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							style: hint,
							children: [
								t("lastConsolidation"),
								"：",
								cons ? `${cons.status ?? "unknown"} · ${cons.updatedAt ?? cons.sessionId}` : t("none")
							]
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: field,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: fieldHead,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: label,
								children: t("filesTitle")
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: hint,
							children: t("filesHint")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
							style: input,
							value: active,
							onChange: (event) => {
								loadFile(event.target.value);
							},
							children: FILES.map((file) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
								value: file.id,
								children: [file.label, status?.files.find((item) => item.id === file.id)?.exists ? "" : ` · ${t("missing")}`]
							}, file.id))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							style: hint,
							children: [
								info?.path ?? "",
								info?.managed === "malformed" ? ` · ${t("malformed")}` : "",
								info ? ` · ${info.chars} chars` : ""
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
							style: area,
							value: draft,
							onChange: (event) => {
								setDraft(event.target.value);
							},
							spellCheck: false
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								gap: 8
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: discard,
								disabled: busy,
								onClick: () => {
									saveFile();
								},
								children: t("saveFile")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: discard,
								disabled: busy,
								onClick: () => {
									loadFile(active);
								},
								children: t("reload")
							})]
						}),
						note ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: hint,
							children: note
						}) : null
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: field,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: fieldHead,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: label,
								children: t("knobsTitle")
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: hint,
							children: t("knobsHint")
						}),
						settings.status === "unavailable" || settings.status === "ready" && knobs === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: invalid,
							children: t("settingsUnavailable")
						}) : null
					]
				}),
				FLAGS.map((item) => {
					const on = Boolean(resolved(item.field));
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: field,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: fieldHead,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: label,
									children: t(item.label)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Override, {
									show: fieldOverridden(settings.user, item.field) || item.field in knobDraft,
									disabled,
									overridden: t("overridden"),
									reset: t("reset"),
									onReset: () => {
										setKnobDraft((current) => ({
											...current,
											[item.field]: void 0
										}));
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Switch, {
									on,
									disabled,
									onToggle: () => {
										setKnobDraft((current) => ({
											...current,
											[item.field]: !on
										}));
									}
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: hint,
							children: t(item.hint)
						})]
					}, item.field);
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: field,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: fieldHead,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: label,
								children: t("mode")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Override, {
								show: fieldOverridden(settings.user, "consolidationMode") || "consolidationMode" in knobDraft,
								disabled,
								overridden: t("overridden"),
								reset: t("reset"),
								onReset: () => {
									setKnobDraft((current) => ({
										...current,
										consolidationMode: void 0
									}));
								}
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
							style: input,
							disabled,
							value: resolved("consolidationMode") ?? "automatic",
							onChange: (event) => {
								setKnobDraft((current) => ({
									...current,
									consolidationMode: event.target.value
								}));
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "automatic",
								children: t("modeAutomatic")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "proposal",
								children: t("modeProposal")
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: hint,
							children: t("modeHint")
						})
					]
				}),
				NUMBERS.map((item) => {
					const value = resolved(item.field);
					const text = numberText[item.field] ?? (typeof value === "number" ? String(value) : "");
					const bad = item.field in knobDraft && text !== "" && (!Number.isFinite(Number(text)) || Number(text) < item.min);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: field,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: fieldHead,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									style: label,
									htmlFor: `memory-${item.field}`,
									children: t(item.label)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Override, {
									show: fieldOverridden(settings.user, item.field) || item.field in knobDraft,
									disabled,
									overridden: t("overridden"),
									reset: t("reset"),
									onReset: () => {
										setKnobDraft((current) => ({
											...current,
											[item.field]: void 0
										}));
										setNumberText((current) => {
											const next = { ...current };
											delete next[item.field];
											return next;
										});
									}
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								id: `memory-${item.field}`,
								style: bad ? {
									...input,
									borderColor: "var(--dsw-alias-label-error)"
								} : input,
								inputMode: "numeric",
								disabled,
								value: text,
								onChange: (event) => {
									const raw = event.target.value;
									setNumberText((current) => ({
										...current,
										[item.field]: raw
									}));
									if (raw === "") {
										setKnobDraft((current) => ({
											...current,
											[item.field]: void 0
										}));
										return;
									}
									const next = Number(raw);
									if (Number.isFinite(next) && next >= item.min) setKnobDraft((current) => ({
										...current,
										[item.field]: Math.floor(next)
									}));
									else setKnobDraft((current) => ({
										...current,
										[item.field]: knobs?.[item.field]
									}));
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: bad ? invalid : hint,
								children: bad ? t("invalidNumber") : t(item.hint)
							})
						]
					}, item.field);
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: footer,
					children: [
						failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: {
								...invalid,
								flex: 1,
								minWidth: 0
							},
							role: "status",
							children: t("saveFailed")
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: {
								...discard,
								opacity: !dirty || saving ? .4 : 1,
								cursor: !dirty || saving ? "default" : "pointer"
							},
							disabled: !dirty || saving,
							onClick: () => {
								setKnobDraft({});
								setNumberText({});
								setFailed(false);
							},
							children: t("discard")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: {
								...save,
								opacity: !dirty || invalidNumbers || saving ? .4 : 1,
								cursor: !dirty || invalidNumbers || saving ? "default" : "pointer"
							},
							disabled: !dirty || invalidNumbers || saving,
							onClick: () => {
								saveKnobs();
							},
							children: t(saving ? "saving" : "save")
						})
					]
				})
			]
		}) : null]
	});
}

//#endregion
//#region src/client/index.ts
/** Cordis client plugin name. */
const name = "dsh-file-memory-client";
/** Dictionary namespace for this card's copy. */
const NS = "settings.dshFileMemory";
/** Required browser services. settingsScope.bind needs connection + remote. */
const inject = [
	"slots",
	"locale",
	"connection",
	"remote",
	"settingsScope"
];
/**
* Register the memory card. Host must serve the same `memory` namespace.
*/
function apply(ctx) {
	ctx.effect(() => ctx.locale.register(NS, {
		zh,
		en
	}), "dsh-file-memory: settings card dictionaries");
	const scope = ctx.settingsScope.bind({ namespace: "memory" });
	ctx.slots.inject("settings.plugin.item", function* () {
		yield ctx.slots.register({
			name: "settings.plugin.item",
			key: "memory",
			locale: NS,
			inject: () => ({ scope })
		}, MemoryCard);
	});
}

//#endregion
exports.apply = apply;
exports.inject = inject;
exports.name = name;
return module.exports; } });
//# sourceMappingURL=client.js.map