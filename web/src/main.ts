/* ============================================================
   pi-stbar/web — entry point

   Mounts pi-web-ui's ChatPanel with STBAR styling applied via stbar.css.
   Scaffold version: feature-parity with packages/web-ui/example/, with
   STBAR branding and the look skinned in CSS. The actual visual work
   lives in stbar.css and grows incrementally.
   ============================================================ */
import "@mariozechner/mini-lit/dist/ThemeToggle.js";
import { Agent, type AgentMessage } from "@earendil-works/pi-agent-core";
import { getModel, getProviders, type TextContent } from "@earendil-works/pi-ai";
import {
	type AgentState,
	ApiKeyPromptDialog,
	AppStorage,
	ChatPanel,
	CustomProvidersStore,
	createJavaScriptReplTool,
	defaultConvertToLlm,
	IndexedDBStorageBackend,
	ModelSelector,
	ProviderKeysStore,
	ProvidersModelsTab,
	ProxyTab,
	SessionListDialog,
	SessionsStore,
	SettingsDialog,
	SettingsStore,
	setAppStorage,
} from "@earendil-works/pi-web-ui";
import { html, render } from "lit";
import { FolderOpen, History, Plus, ScrollText, Settings } from "lucide";
import { icon } from "@mariozechner/mini-lit";
import { Button } from "@mariozechner/mini-lit/dist/Button.js";
import { Input } from "@mariozechner/mini-lit/dist/Input.js";
import "@fontsource/vt323";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/700.css";
import "@fontsource/press-start-2p";
import "@fontsource/black-ops-one";
import "./stbar.css";
import { createFsTools, getWorkspaceName, hasWorkspace, pickWorkspaceFolder } from "./fs-tools.js";

// ============================================================
// STORAGE
// ============================================================
const settings = new SettingsStore();
const providerKeys = new ProviderKeysStore();
const sessions = new SessionsStore();
const customProviders = new CustomProvidersStore();

const configs = [
	settings.getConfig(),
	SessionsStore.getMetadataConfig(),
	providerKeys.getConfig(),
	customProviders.getConfig(),
	sessions.getConfig(),
];

// V1: IndexedDB-only (browser-local sessions). Same-session sharing
// with terminal pi happens in Phase 3c via Tauri filesystem access
// OR a localhost daemon — decision deferred.
const backend = new IndexedDBStorageBackend({
	dbName: "pi-stbar-web",
	version: 1,
	stores: configs,
});

settings.setBackend(backend);
providerKeys.setBackend(backend);
customProviders.setBackend(backend);
sessions.setBackend(backend);

const storage = new AppStorage(settings, providerKeys, sessions, customProviders, backend);
setAppStorage(storage);

// STBAR is a dark aesthetic (UAC monitor) — force dark mode and ignore the
// light toggle, which has no STBAR palette and renders unreadable.
document.documentElement.classList.add("dark");
try {
	localStorage.setItem("theme", "dark");
} catch {
	/* ignore */
}

// ============================================================
// SESSION STATE
// ============================================================
let currentSessionId: string | undefined;
let currentTitle = "";
let isEditingTitle = false;
let agent: Agent;
let chatPanel: ChatPanel;
let agentUnsubscribe: (() => void) | undefined;

const generateTitle = (messages: AgentMessage[]): string => {
	const firstUserMsg = messages.find((m) => m.role === "user");
	if (!firstUserMsg) return "";

	let text = "";
	const content = firstUserMsg.content;

	if (typeof content === "string") {
		text = content;
	} else {
		const textBlocks = content.filter((c): c is TextContent => c.type === "text");
		text = textBlocks.map((c) => c.text || "").join(" ");
	}

	text = text.trim();
	if (!text) return "";

	const sentenceEnd = text.search(/[.!?]/);
	if (sentenceEnd > 0 && sentenceEnd <= 50) {
		return text.substring(0, sentenceEnd + 1);
	}
	return text.length <= 50 ? text : `${text.substring(0, 47)}...`;
};

const shouldSaveSession = (messages: AgentMessage[]): boolean => {
	const hasUserMsg = messages.some((m) => m.role === "user");
	const hasAssistantMsg = messages.some((m) => m.role === "assistant");
	return hasUserMsg && hasAssistantMsg;
};

const saveSession = async () => {
	if (!storage.sessions || !currentSessionId || !agent || !currentTitle) return;

	const state = agent.state;
	if (!shouldSaveSession(state.messages)) return;

	try {
		const sessionData = {
			id: currentSessionId,
			title: currentTitle,
			model: state.model!,
			thinkingLevel: state.thinkingLevel,
			messages: state.messages,
			createdAt: new Date().toISOString(),
			lastModified: new Date().toISOString(),
		};

		const metadata = {
			id: currentSessionId,
			title: currentTitle,
			createdAt: sessionData.createdAt,
			lastModified: sessionData.lastModified,
			messageCount: state.messages.length,
			usage: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			modelId: state.model?.id || null,
			thinkingLevel: state.thinkingLevel,
			preview: generateTitle(state.messages),
		};

		await storage.sessions.save(sessionData, metadata);
	} catch (err) {
		console.error("Failed to save session:", err);
	}
};

const updateUrl = (sessionId: string) => {
	const url = new URL(window.location.href);
	url.searchParams.set("session", sessionId);
	window.history.replaceState({}, "", url);
};

// ============================================================
// AGENT
// ============================================================

// Remember the last-used model so NEW sessions default to it instead of a
// hardcoded model — otherwise every new/changed thread resets to claude and
// you have to re-pick your model from the full provider list each time.
const FALLBACK_MODEL = getModel("anthropic", "claude-sonnet-4-5-20250929");

const loadDefaultModel = async () => {
	try {
		const saved = await storage.settings.get<any>("lastModel");
		return saved ?? FALLBACK_MODEL;
	} catch {
		return FALLBACK_MODEL;
	}
};

// Providers worth showing in the model selector: built-in providers you have a
// key for, plus every custom provider (Ollama etc.), plus the currently-selected
// model's provider. Returns undefined (= no filter, show everything) if that
// set would be empty, so we never accidentally hide all models.
const computeAllowedProviders = async (currentProvider?: string): Promise<string[] | undefined> => {
	const allowed = new Set<string>();
	try {
		for (const provider of getProviders()) {
			const key = await storage.providerKeys.get(provider);
			if (key) allowed.add(provider);
		}
	} catch {
		/* ignore — fall through to no-filter if nothing resolves */
	}
	try {
		for (const cp of await customProviders.getAll()) {
			if (cp.name) allowed.add(cp.name); // custom provider name == Model.provider
		}
	} catch {
		/* ignore */
	}
	if (currentProvider) allowed.add(currentProvider);
	return allowed.size > 0 ? [...allowed] : undefined;
};

const openModelSelector = async () => {
	const current = agent?.state.model;
	const allowed = await computeAllowedProviders(current?.provider);
	ModelSelector.open(
		current,
		(model) => {
			if (agent) {
				agent.state.model = model;
				storage.settings.set("lastModel", model).catch(() => {});
				// Re-render so the editor's model label updates immediately.
				(chatPanel.querySelector("agent-interface") as { requestUpdate?: () => void } | null)?.requestUpdate?.();
			}
		},
		allowed,
	);
};

const createAgent = async (initialState?: Partial<AgentState>) => {
	if (agentUnsubscribe) agentUnsubscribe();

	const defaultModel = await loadDefaultModel();

	agent = new Agent({
		initialState: initialState || {
			systemPrompt: `You are a coding agent operating from a UAC tactical terminal.

You have REAL file tools over a workspace folder the user grants:
- ls (path) — list a directory; use "." for the workspace root.
- read (path) — read a file.
- write (path, content) — create or overwrite a file.
- edit (path, oldText, newText) — replace an exact, unique snippet.
You also have a JavaScript REPL (sandboxed) and an artifacts tool.

When the user asks about their files, their project, or "this folder", DO NOT say you can't access files and DO NOT ask them to open a folder first — just CALL ls with path "." and look. Act first, explain after. Only if a file tool returns an error saying no workspace is granted should you tell the user to click the folder button in the header. Prefer using the tools over describing what you would do.`,
			model: defaultModel,
			thinkingLevel: "off",
			messages: [],
			tools: [],
		},
		convertToLlm: defaultConvertToLlm,
	});

	agentUnsubscribe = agent.subscribe((event: any) => {
		// The agent mutates state.messages IN PLACE (agent.ts pushes onto the
		// same array). pi-web-ui's MessageList dirty-checks its `messages`
		// property by reference, so it never sees the change and renders empty
		// after a turn — the message appears to vanish. MessageList already
		// holds a reference to that same live array, so poking it to re-render
		// makes it reflect the current messages. (No duplicate with the
		// streaming container: the in-progress message isn't in state.messages
		// until message_end, by which point the streaming container is cleared.)
		const messageList = chatPanel.querySelector("message-list") as { requestUpdate?: () => void } | null;
		messageList?.requestUpdate?.();

		// Keep the STBAR HUD footer in sync with agent state.
		renderHud();

		// Session + title bookkeeping once a full turn completes. NOTE: the
		// current pi-agent-core emits granular events (agent_end, message_end,
		// …), NOT the "state-update" event the older example listened for.
		if (event.type === "agent_end") {
			// At agent_end, state.isStreaming is STILL true — the agent flips it
			// false in finishRun() AFTER these listeners run, and emits no further
			// event. AgentInterface's last render therefore keeps isStreaming=true,
			// which disables the editor and blocks sendMessage(), so follow-up
			// messages never send. Re-render AgentInterface on the next macrotask
			// (after finishRun has settled) so the editor re-enables.
			setTimeout(() => {
				(chatPanel.querySelector("agent-interface") as { requestUpdate?: () => void } | null)?.requestUpdate?.();
				(chatPanel.querySelector("message-list") as { requestUpdate?: () => void } | null)?.requestUpdate?.();
			}, 0);

			// Persist the model used this turn so new sessions reuse it.
			if (agent.state.model) {
				storage.settings.set("lastModel", agent.state.model).catch(() => {});
			}

			const messages = agent.state.messages;
			const prevTitle = currentTitle;
			const prevSessionId = currentSessionId;

			if (!currentTitle && shouldSaveSession(messages)) {
				currentTitle = generateTitle(messages);
			}
			if (!currentSessionId && shouldSaveSession(messages)) {
				currentSessionId = crypto.randomUUID();
				updateUrl(currentSessionId);
			}
			if (currentSessionId) saveSession();

			if (currentTitle !== prevTitle || currentSessionId !== prevSessionId) {
				renderHeader();
			}
		}
	});

	await chatPanel.setAgent(agent, {
		onApiKeyRequired: async (provider: string) => {
			// Custom providers (Ollama, etc.) store their API key in the
			// custom-provider config, but pi-web-ui's send-time check only
			// consults the providerKeys store. If a configured custom provider
			// already has a key, mirror it into providerKeys and proceed —
			// otherwise the user is re-prompted for a key they already entered.
			try {
				const custom = (await customProviders.getAll()).find((c) => c.name === provider);
				if (custom?.apiKey) {
					await storage.providerKeys.set(provider, custom.apiKey);
					return true;
				}
			} catch {
				/* fall through to the prompt */
			}
			return ApiKeyPromptDialog.prompt(provider);
		},
		onModelSelect: () => {
			openModelSelector();
		},
		toolsFactory: (_agent, _agentInterface, _artifactsPanel, runtimeProvidersFactory) => {
			const replTool = createJavaScriptReplTool();
			replTool.runtimeProvidersFactory = runtimeProvidersFactory;
			return [replTool, ...createFsTools()];
		},
	});
};

const loadSession = async (sessionId: string): Promise<boolean> => {
	if (!storage.sessions) return false;

	const sessionData = await storage.sessions.get(sessionId);
	if (!sessionData) {
		console.error("Session not found:", sessionId);
		return false;
	}

	currentSessionId = sessionId;
	const metadata = await storage.sessions.getMetadata(sessionId);
	currentTitle = metadata?.title || "";

	await createAgent({
		model: sessionData.model,
		thinkingLevel: sessionData.thinkingLevel,
		messages: sessionData.messages,
		tools: [],
	});

	updateUrl(sessionId);
	renderHeader();
	return true;
};

const newSession = () => {
	const url = new URL(window.location.href);
	url.search = "";
	window.location.href = url.toString();
};

// ============================================================
// RENDER
//
// IMPORTANT: chatPanel is a self-managing custom element. It is mounted ONCE
// as a real DOM child (see mountShell) and is never re-rendered through a lit
// template — that collides with its internal DOM surgery and drops messages.
// Only the header + HUD are lit-rendered.
// ============================================================

const headerTemplate = () => html`
	<div class="flex items-center gap-3 px-4 py-2">
		<div class="stbar-logo-wrap">
			<span class="stbar-logo">PI · STBAR</span>
			<span class="stbar-logo-sub">UAC CODING TERMINAL</span>
		</div>
		${Button({
			variant: "ghost",
			size: "sm",
			children: icon(History, "sm"),
			onClick: () => {
				SessionListDialog.open(
					async (sessionId) => {
						await loadSession(sessionId);
					},
					(deletedSessionId) => {
						if (deletedSessionId === currentSessionId) newSession();
					},
				);
			},
			title: "Sessions",
		})}
		${Button({
			variant: "ghost",
			size: "sm",
			children: icon(Plus, "sm"),
			onClick: newSession,
			title: "New Session",
		})}
		${Button({
			variant: "ghost",
			size: "sm",
			children: icon(FolderOpen, "sm"),
			onClick: async () => {
				if (await pickWorkspaceFolder()) renderHeader();
			},
			title: hasWorkspace() ? `Workspace: ${getWorkspaceName()}` : "Open Folder (grant file access)",
		})}
		${Button({
			variant: "ghost",
			size: "sm",
			children: icon(ScrollText, "sm"),
			onClick: showBallad,
			title: "The Ballad of Doom Guy",
		})}
		${
			currentTitle
				? isEditingTitle
					? html`<div class="flex items-center gap-2">
						${Input({
							type: "text",
							value: currentTitle,
							className: "text-sm w-64",
							onChange: async (e: Event) => {
								const newTitle = (e.target as HTMLInputElement).value.trim();
								if (newTitle && newTitle !== currentTitle && storage.sessions && currentSessionId) {
									await storage.sessions.updateTitle(currentSessionId, newTitle);
									currentTitle = newTitle;
								}
								isEditingTitle = false;
								renderHeader();
							},
							onKeyDown: async (e: KeyboardEvent) => {
								if (e.key === "Enter") {
									const newTitle = (e.target as HTMLInputElement).value.trim();
									if (newTitle && newTitle !== currentTitle && storage.sessions && currentSessionId) {
										await storage.sessions.updateTitle(currentSessionId, newTitle);
										currentTitle = newTitle;
									}
									isEditingTitle = false;
									renderHeader();
								} else if (e.key === "Escape") {
									isEditingTitle = false;
									renderHeader();
								}
							},
						})}
					</div>`
					: html`<button
						class="px-2 py-1 text-sm text-foreground hover:bg-secondary transition-colors"
						@click=${() => {
							isEditingTitle = true;
							renderHeader();
							requestAnimationFrame(() => {
								const input = document.querySelector('#stbar-header input[type="text"]') as HTMLInputElement;
								if (input) {
									input.focus();
									input.select();
								}
							});
						}}
						title="Click to edit title"
					>
						${currentTitle}
					</button>`
				: html`<span class="stbar-logo-sub" style="opacity:0.7">AWAITING ORDERS</span>`
		}
	</div>
	<div class="flex items-center gap-3 px-3">
		<span class="stbar-status"><span class="stbar-dot"></span>ONLINE</span>
		<span class="stbar-sep">│</span>
		<span class="stbar-status" id="stbar-clock"></span>
		${Button({
			variant: "ghost",
			size: "sm",
			children: icon(Settings, "sm"),
			onClick: () => SettingsDialog.open([new ProvidersModelsTab(), new ProxyTab()]),
			title: "Settings",
		})}
	</div>
`;

const renderHeader = () => {
	const header = document.getElementById("stbar-header");
	if (!header) return;
	render(headerTemplate(), header);
};

// ---- Status HUD footer (the STBAR plate) ----
const fmtTokens = (n: number): string =>
	n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

const computeHud = () => {
	const s: any = agent?.state;
	const model: any = s?.model;
	const msgs: any[] = s?.messages ?? [];
	let cost = 0;
	let input = 0;
	let output = 0;
	let cacheRead = 0;
	let cacheWrite = 0;
	let lastCtx = 0;
	for (const m of msgs) {
		if (m.role === "assistant" && m.usage) {
			input += m.usage.input ?? 0;
			output += m.usage.output ?? 0;
			cacheRead += m.usage.cacheRead ?? 0;
			cacheWrite += m.usage.cacheWrite ?? 0;
			cost += m.usage.cost?.total ?? 0;
			lastCtx = (m.usage.input ?? 0) + (m.usage.cacheRead ?? 0);
		}
	}
	const totalTokens = input + output + cacheRead + cacheWrite;
	const ctxWindow = model?.contextWindow ?? 0;
	const usedPct = ctxWindow > 0 ? Math.min(100, (lastCtx / ctxWindow) * 100) : 0;
	const health = ctxWindow > 0 ? Math.max(0, Math.round(100 - usedPct)) : 100;
	return {
		health,
		cost,
		totalTokens,
		model: (model?.id ?? model?.name ?? "—") as string,
		zone: currentTitle || "main",
		threat: Boolean(s?.errorMessage),
	};
};

const renderHud = () => {
	const hud = document.getElementById("stbar-hud");
	if (!hud) return;
	const d = computeHud();
	const healthColor =
		d.health > 50 ? "var(--stbar-marine)" : d.health > 25 ? "var(--stbar-key)" : "var(--stbar-blood-bright)";
	render(
		html`
			<div class="stbar-hud-cell">
				<span class="stbar-hud-label">Health</span>
				<span class="stbar-hud-value" style="color:${healthColor}">${d.health}%</span>
			</div>
			<div class="stbar-hud-cell">
				<span class="stbar-hud-label">Armor</span>
				<span class="stbar-hud-value" style="color:var(--stbar-armor)">$${d.cost.toFixed(2)}</span>
			</div>
			<div class="stbar-hud-cell">
				<span class="stbar-hud-label">Ammo</span>
				<span class="stbar-hud-value" style="color:var(--stbar-key)">${fmtTokens(d.totalTokens)}</span>
			</div>
			<div class="stbar-hud-cell">
				<span class="stbar-hud-label">Weapon</span>
				<span class="stbar-hud-value stbar-hud-value--sm" title=${d.model}>${d.model.toUpperCase()}</span>
			</div>
			<div class="stbar-hud-cell">
				<span class="stbar-hud-label">Zone</span>
				<span class="stbar-hud-value stbar-hud-value--sm" title=${d.zone}>${d.zone}</span>
			</div>
			<div class="stbar-hud-cell">
				<span class="stbar-hud-label">Threat</span>
				<span class="stbar-hud-value" style="color:${d.threat ? "var(--stbar-blood-bright)" : "var(--stbar-marine)"}">
					${d.threat ? "!!" : "OK"}
				</span>
			</div>
		`,
		hud,
	);
};

const mountShell = () => {
	const app = document.getElementById("app");
	if (!app) return;
	app.replaceChildren();

	const shell = document.createElement("div");
	shell.className = "w-full h-screen flex flex-col bg-background text-foreground overflow-hidden";

	const header = document.createElement("div");
	header.id = "stbar-header";
	header.className = "flex items-center justify-between border-b border-border shrink-0";
	shell.appendChild(header);

	chatPanel.style.flex = "1 1 auto";
	chatPanel.style.minHeight = "0";
	chatPanel.style.display = "block";
	shell.appendChild(chatPanel);

	const hud = document.createElement("div");
	hud.id = "stbar-hud";
	hud.className = "shrink-0";
	shell.appendChild(hud);

	app.appendChild(shell);
	renderHeader();
	renderHud();

	// Inject per-message COPY buttons; re-run as the message list mutates.
	const copyObserver = new MutationObserver(() => requestAnimationFrame(enhanceCopyButtons));
	copyObserver.observe(chatPanel, { childList: true, subtree: true });
	enhanceCopyButtons();

	const tickClock = () => {
		const c = document.getElementById("stbar-clock");
		if (c) c.textContent = new Date().toLocaleTimeString([], { hour12: false });
	};
	tickClock();
	setInterval(tickClock, 1000);
};

// ============================================================
// INIT
// ============================================================
const bootLines: Array<{ t: string; msg: string; ok?: boolean }> = [
	{ t: "0.00", msg: "UAC-NET: establishing uplink…" },
	{ t: "0.21", msg: "AUTH: marine clearance accepted", ok: true },
	{ t: "0.44", msg: "LOADING: tactical interface · STBAR" },
	{ t: "0.69", msg: "WEAPONS HOT" },
	{ t: "0.88", msg: "READY", ok: true },
];

// Cinematic first-paint reveal (~800ms), then the shell mounts.
const runBootSequence = async () => {
	const app = document.getElementById("app");
	if (!app) return;
	const shown: typeof bootLines = [];
	for (const line of bootLines) {
		shown.push(line);
		render(
			html`<div id="stbar-boot">
				<span class="stbar-boot-logo">PI · STBAR</span>
				${shown.map(
					(l) => html`<div class="stbar-boot-line"><span class="ts">[${l.t}]</span> <span class=${l.ok ? "ok" : ""}>${l.msg}</span></div>`,
				)}
				<div class="stbar-boot-line"><span class="cursor">█</span></div>
			</div>`,
			app,
		);
		await new Promise((r) => setTimeout(r, 260));
	}
	await new Promise((r) => setTimeout(r, 300));
};

// ============================================================
// THE BALLAD — lore overlay (easter egg)
// ============================================================
const balladIntro = [
	"In armor green with visage stern,",
	"Through hell's own gates he dares to burn.",
	"No words he speaks, no fear he shows,",
	"Just double barrels where demons rose.",
];
const balladSections: Array<{ h: string; stanzas: string[][] }> = [
	{ h: "I. The Descent", stanzas: [
		["Phobos base went dark that day,", "When hell broke loose in bloody fray.", "But one marine stood tall and proud,", "Silent amidst the screaming crowd."],
		["No panic in his steely gaze,", "No retreat through fire and haze.", "He grabbed his shotgun, checked his shells,", "And marched straight into hell itself."],
	] },
	{ h: "II. The Arsenal", stanzas: [
		["Rocket launcher, plasma gun,", "The BFG when day is done.", "Chainsaw roaring, hungry, loud,", "Making demons scream aloud."],
		["Super shotgun, two at once,", "Hell's horde he brutally renounces.", "Every round, every blast,", "A reckoning that's built to last."],
	] },
	{ h: "III. The Legend", stanzas: [
		["They say he's died a thousand times,", "Committed unspeakable crimes", "Against the forces of the pit,", "Yet never does his spirit split."],
		["Rip and tear until it's done,", "That is his code, that is his run.", "No save points, no retreat,", "Just victory or defeat."],
	] },
	{ h: "IV. The Truth", stanzas: [
		["He doesn't fight for glory's sake,", "Or for the promises they make.", "He fights because the demons came,", "And Doom Guy never plays their game."],
		["So if you hear a shotgun's sound,", "And hellspawn falling to the ground,", "Know that the Slayer walks again,", "The bane of hell, the fear of men."],
	] },
];

const showBallad = () => {
	const host = document.createElement("div");
	const onKey = (e: KeyboardEvent) => {
		if (e.key === "Escape") close();
	};
	const close = () => {
		host.remove();
		document.removeEventListener("keydown", onKey);
	};
	document.addEventListener("keydown", onKey);
	render(
		html`<div
			class="stbar-ballad-backdrop"
			@click=${(e: Event) => {
				if (e.target === e.currentTarget) close();
			}}
		>
			<div class="stbar-ballad-panel">
				<button class="stbar-ballad-close" @click=${close} title="Close">✕</button>
				<h1 class="stbar-ballad-title">The Ballad of Doom Guy</h1>
				<div class="stbar-ballad-intro">${balladIntro.map((l) => html`<div>${l}</div>`)}</div>
				${balladSections.map(
					(sec) => html`<h2 class="stbar-ballad-h">${sec.h}</h2>${sec.stanzas.map(
						(st) => html`<div class="stbar-ballad-stanza">${st.map((l) => html`<div>${l}</div>`)}</div>`,
					)}`,
				)}
				<div class="stbar-ballad-closing">Rip and tear, until it is done.</div>
			</div>
		</div>`,
		host,
	);
	document.body.appendChild(host);
};

// Inject a per-message COPY button onto every committed message (user +
// assistant). pi-web-ui has no per-message copy, so we add it in the DOM and
// re-run as the message list mutates (see the observer in mountShell).
const enhanceCopyButtons = () => {
	if (!chatPanel) return;
	chatPanel.querySelectorAll("user-message, assistant-message").forEach((el) => {
		const node = el as HTMLElement;
		if (node.dataset.stbarCopy) return;
		node.dataset.stbarCopy = "1";
		if (getComputedStyle(node).position === "static") node.style.position = "relative";
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = "stbar-copy-btn";
		btn.textContent = "COPY";
		btn.title = "Copy message";
		btn.addEventListener("click", async (ev) => {
			ev.stopPropagation();
			const clone = node.cloneNode(true) as HTMLElement;
			clone.querySelectorAll(".stbar-copy-btn").forEach((b) => b.remove());
			try {
				await navigator.clipboard.writeText(clone.innerText.trim());
				btn.textContent = "COPIED";
			} catch {
				btn.textContent = "ERR";
			}
			setTimeout(() => {
				btn.textContent = "COPY";
			}, 1200);
		});
		node.appendChild(btn);
	});
};

async function initApp() {
	const app = document.getElementById("app");
	if (!app) throw new Error("App container not found");

	await runBootSequence();

	chatPanel = new ChatPanel();

	mountShell();

	const urlParams = new URLSearchParams(window.location.search);
	const sessionIdFromUrl = urlParams.get("session");

	if (sessionIdFromUrl) {
		const loaded = await loadSession(sessionIdFromUrl);
		if (!loaded) {
			newSession();
			return;
		}
	} else {
		await createAgent();
	}

	renderHeader();
	renderHud();
}

initApp();
