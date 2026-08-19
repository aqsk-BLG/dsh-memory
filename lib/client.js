window.__ModuleLoader__.load({ id: "dsh-file-memory", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
let react = require("react");
let react_jsx_runtime = require("react/jsx-runtime");

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
		cn: "每轮提醒",
		en: "Turn reminder"
	},
	{
		field: "semanticEnabled",
		cn: "语义召回",
		en: "Semantic recall"
	},
	{
		field: "semanticFallbackEnabled",
		cn: "全文回退",
		en: "Full-text fallback"
	},
	{
		field: "flushEnabled",
		cn: "压缩后冲刷",
		en: "Compaction flush"
	},
	{
		field: "consolidationEnabled",
		cn: "后台巩固",
		en: "Background consolidation"
	}
];
const NUMBERS = [
	{
		field: "consolidationEveryEligibleTurns",
		cn: "每 N 个合格轮次巩固一次",
		en: "Consolidate every N eligible turns",
		min: 1
	},
	{
		field: "memoryBudgetChars",
		cn: "MEMORY 预算",
		en: "MEMORY budget",
		min: 1
	},
	{
		field: "userBudgetChars",
		cn: "USER 预算",
		en: "USER budget",
		min: 1
	},
	{
		field: "projectMemoryBudgetChars",
		cn: "项目 MEMORY 预算",
		en: "Project MEMORY budget",
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
const page = {
	display: "grid",
	gap: 16,
	padding: "4px 2px 12px",
	color: "var(--dsw-alias-label-primary, #e8eef7)",
	fontFamily: "inherit"
};
const h = {
	margin: 0,
	fontSize: 16,
	fontWeight: 650
};
const p = {
	margin: 0,
	color: "var(--dsw-alias-label-secondary, #9aa8bd)",
	fontSize: 13,
	lineHeight: 1.45
};
const card = {
	display: "grid",
	gap: 10,
	padding: 12,
	border: "1px solid var(--dsw-alias-border-default, #2a3545)",
	borderRadius: 10,
	background: "var(--dsw-alias-bg-layer-1, #151b24)"
};
const row = {
	display: "flex",
	flexWrap: "wrap",
	gap: 8,
	alignItems: "center"
};
const chip = (on) => ({
	border: `1px solid ${on ? "var(--dsw-alias-brand-primary, #4da3ff)" : "var(--dsw-alias-border-default, #2a3545)"}`,
	background: on ? "color-mix(in srgb, var(--dsw-alias-brand-primary, #4da3ff) 18%, transparent)" : "transparent",
	color: "inherit",
	borderRadius: 999,
	padding: "4px 10px",
	cursor: "pointer",
	font: "inherit"
});
const area = {
	width: "100%",
	minHeight: 240,
	resize: "vertical",
	boxSizing: "border-box",
	padding: 10,
	borderRadius: 8,
	border: "1px solid var(--dsw-alias-border-default, #2a3545)",
	background: "var(--dsw-alias-bg-layer-0, #0f141b)",
	color: "inherit",
	font: "12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
};
const btn = {
	border: "1px solid var(--dsw-alias-border-default, #2a3545)",
	background: "var(--dsw-alias-bg-layer-2, #1c2430)",
	color: "inherit",
	borderRadius: 8,
	padding: "6px 12px",
	cursor: "pointer",
	font: "inherit"
};
const input = {
	width: 112,
	boxSizing: "border-box",
	padding: "4px 8px",
	borderRadius: 8,
	border: "1px solid var(--dsw-alias-border-default, #2a3545)",
	background: "var(--dsw-alias-bg-layer-0, #0f141b)",
	color: "inherit",
	font: "inherit"
};
const warn = {
	margin: 0,
	color: "var(--dsw-alias-label-warning, #e0b15a)",
	fontSize: 12
};
const tiny = {
	...btn,
	padding: "2px 8px",
	fontSize: 12
};
function fieldOverridden(user, field) {
	return typeof user === "object" && user !== null && !Array.isArray(user) && Object.prototype.hasOwnProperty.call(user, field);
}
function useSettings(scope) {
	return (0, react.useSyncExternalStore)((listener) => scope === void 0 ? () => {} : scope.subscribe(listener), () => scope === void 0 ? EMPTY : scope.getSnapshot(), () => scope === void 0 ? EMPTY : scope.getSnapshot());
}
async function getJson(path) {
	const res = await fetch(path);
	if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
	return await res.json();
}
function NumberField(props) {
	const [text, setText] = (0, react.useState)(props.value === void 0 ? "" : String(props.value));
	(0, react.useEffect)(() => {
		setText(props.value === void 0 ? "" : String(props.value));
	}, [props.value]);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
		style: {
			display: "grid",
			gap: 4
		},
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: props.label }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				style: p,
				children: props.hint
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				style: row,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					style: input,
					type: "number",
					min: props.min,
					value: text,
					disabled: props.disabled,
					onChange: (event) => {
						setText(event.target.value);
					},
					onBlur: () => {
						const next = Number(text);
						if (Number.isFinite(next) && next >= props.min) props.onCommit(Math.floor(next));
					}
				}), props.overridden ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					style: tiny,
					disabled: props.disabled,
					onClick: props.onReset,
					children: "重置 / Reset"
				}) : null]
			})
		]
	});
}
/** Settings card: status, four core files, common toggles. */
function MemoryCard(props) {
	const [status, setStatus] = (0, react.useState)();
	const [active, setActive] = (0, react.useState)("memory");
	const [draft, setDraft] = (0, react.useState)("");
	const [hash, setHash] = (0, react.useState)("");
	const [info, setInfo] = (0, react.useState)();
	const [note, setNote] = (0, react.useState)();
	const [busy, setBusy] = (0, react.useState)(false);
	const settings = useSettings(props.scope);
	const knobs = settings.value;
	const disabled = !settings.writable || settings.status !== "ready" || knobs === void 0;
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
		reloadStatus().then(() => loadFile("memory")).catch((error) => {
			setNote(error instanceof Error ? error.message : String(error));
		});
	}, [loadFile, reloadStatus]);
	const save = async () => {
		setBusy(true);
		try {
			const body = await (await fetch(`${API}/files/${active}`, {
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					content: draft,
					expectedHash: hash
				})
			})).json();
			if (!body.ok) {
				setNote(body.message ?? body.reason ?? "save failed");
				if (body.file) {
					setInfo(body.file);
					setHash(body.file.contentHash);
				}
				return;
			}
			if (body.file) {
				setInfo(body.file);
				setDraft(body.file.content);
				setHash(body.file.contentHash);
			}
			setNote("已保存。下一轮会话才会注入提示词。 / Saved. Next session turn picks this up.");
			await reloadStatus();
		} catch (error) {
			setNote(error instanceof Error ? error.message : String(error));
		} finally {
			setBusy(false);
		}
	};
	const hostLine = status === void 0 ? "读取中… / Loading…" : `${status.host?.version ?? "未知宿主 / unknown host"} · plugin ${status.pluginVersion} · gate ${status.hostAssessment.reason}`;
	const cons = status?.lastConsolidation;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: page,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
					style: h,
					children: "dsh-file-memory"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					style: p,
					children: "分层文件记忆。状态只读；USER / MEMORY / IDENTITY / SOUL 可看可改。"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					style: p,
					children: "Layered file memory. Status is read-only; the four core files are editable."
				})
			] }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				style: card,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "状态 / Status" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: p,
						children: hostLine
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						style: p,
						children: ["Home：", status?.home ?? "—"]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						style: p,
						children: ["召回索引 / Recall index：", status?.sessionQuery.exists ? `${status.sessionQuery.bytes} bytes` : "未建立 / missing"]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						style: p,
						children: ["最近巩固 / Last consolidation：", cons ? `${cons.status ?? "unknown"} · ${cons.updatedAt ?? cons.sessionId}` : "还没有 / none"]
					})
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				style: card,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "核心文件 / Core files" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: p,
						children: "USER / MEMORY 保存时会校验 consolidator 受管区。人手写的区域不会被巩固器改。"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: p,
						children: "Saves validate the consolidator managed region. Human-written sections stay untouched."
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: row,
						children: FILES.map((file) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							style: chip(active === file.id),
							onClick: () => {
								loadFile(file.id);
							},
							children: [file.label, status?.files.find((item) => item.id === file.id)?.exists ? "" : " · 缺"]
						}, file.id))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						style: p,
						children: [
							info?.path ?? "",
							info?.managed === "malformed" ? " · 受管区损坏 / malformed region" : "",
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
						style: row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: btn,
							disabled: busy,
							onClick: () => {
								save();
							},
							children: "保存 / Save"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: btn,
							disabled: busy,
							onClick: () => {
								loadFile(active);
							},
							children: "重新加载 / Reload"
						})]
					}),
					note ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: warn,
						children: note
					}) : null
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				style: card,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "常用开关 / Common knobs" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: p,
						children: "写入官方设置文档。立刻落盘，下次启动 DSH 才生效。"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: p,
						children: "Writes the official settings document now. Takes effect on the next DSH start."
					}),
					settings.status === "loading" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: p,
						children: "读取设置中… / Loading settings…"
					}) : null,
					settings.status === "unavailable" || settings.status === "ready" && knobs === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: warn,
						children: "设置通道不可用。开关仍可改 `cordis.patch.yml`。 / Settings scope unavailable."
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: row,
						children: FLAGS.map((flag) => {
							const on = Boolean(knobs?.[flag.field]);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								style: row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									style: chip(on),
									disabled,
									onClick: () => {
										props.scope?.set(flag.field, !on);
									},
									children: [
										flag.cn,
										" / ",
										flag.en,
										" · ",
										on ? "开" : "关"
									]
								}), fieldOverridden(settings.user, flag.field) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: tiny,
									disabled,
									onClick: () => {
										props.scope?.unset(flag.field);
									},
									children: "重置 / Reset"
								}) : null]
							}, flag.field);
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: row,
						children: [["automatic", "proposal"].map((mode) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: chip(knobs?.consolidationMode === mode),
							disabled,
							onClick: () => {
								props.scope?.set("consolidationMode", mode);
							},
							children: mode === "automatic" ? "自动写入 / automatic" : "只提案 / proposal"
						}, mode)), fieldOverridden(settings.user, "consolidationMode") ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: tiny,
							disabled,
							onClick: () => {
								props.scope?.unset("consolidationMode");
							},
							children: "重置 / Reset"
						}) : null]
					}),
					NUMBERS.map((field) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NumberField, {
						label: field.cn,
						hint: field.en,
						min: field.min,
						value: typeof knobs?.[field.field] === "number" ? knobs[field.field] : void 0,
						overridden: fieldOverridden(settings.user, field.field),
						disabled,
						onCommit: (value) => {
							props.scope?.set(field.field, value);
						},
						onReset: () => {
							props.scope?.unset(field.field);
						}
					}, field.field))
				]
			})
		]
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