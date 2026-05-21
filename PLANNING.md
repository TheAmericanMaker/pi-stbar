# pi-stbar — Planning

STBAR (DOOM 1993-inspired) styling for pi. Two faces, one `pi-agent-core`:
a terminal extension and a web app skinned with `doom.css`.

## In Progress

- **Phase 3b — Web face** (`web/`): pi-web-ui ChatPanel skinned with STBAR CSS.
  Scaffold + core wiring done; visual skin polish ongoing.

## Completed

- Theme JSON `stbar.json` — 51-token pi theme, schema-validated — 2026-05-19
- `preview.html` / `preview.ts` — static CSS + terminal previews — 2026-05-19
- Restructured `themes/stbar/` → `packages/stbar/` with extension/ web/ web-tauri/ fonts/ — 2026-05-19
- Web face scaffold (`web/`): Vite + Lit + Tailwind v4, mounts pi-web-ui ChatPanel — 2026-05-19
- Fixed lit/ChatPanel render conflict ("Node cannot be found"): mount chatPanel once, lit-render only the header — 2026-05-20
- Fixed vanishing-message bug: agent mutates `state.messages` in place; poke MessageList.requestUpdate() each event so it reflects the live array — 2026-05-20
- Fixed dead session/title logic: current pi-agent-core emits granular events (agent_end, message_end…), not "state-update" — 2026-05-20
- Fixed editor stuck disabled after first turn: isStreaming flips false in finishRun() AFTER agent_end with no further event; re-render AgentInterface on a post-agent_end macrotask — 2026-05-20
- Restored `convertToLlm: defaultConvertToLlm` on the Agent — 2026-05-20
- Web face confirmed working end-to-end (send, stream, JS-REPL tool, follow-ups) — 2026-05-20
- Model selector: remembers last-used model for new sessions; filtered to configured providers — 2026-05-20
- STBAR skin pass 1: message plates, tool cards, thinking blocks, editor, buttons, tables, scrollbars — 2026-05-20
- STBAR skin pass 2: header topbar (logo + status strip + live clock) and six-cell HUD footer (live context/cost/tokens/model) — 2026-05-20
- Fonts wired: OFL faces via @fontsource npm (VT323, IBM Plex Mono, Press Start 2P, Black Ops One); AmazDooM copied locally from STBAR repo into web/public/fonts/ + @font-face. Confirmed working — 2026-05-20
- File access: web agent gained read/write/edit/ls tools via File System Access API (web/src/fs-tools.ts) + a folder-grant button; Chrome/Edge only, no shell — 2026-05-20
- Polish pass: boot sequence on first paint, radar-yellow loader, marine/blood tool-status colors, fs-tool mission-verb labels (SCAN/READ/INSCRIBE/MODIFY), dialog backdrop, prefers-reduced-motion guard — 2026-05-20
- Forced dark mode + removed light theme toggle (STBAR is dark-only; light mode washed out bone text); doubled boot timing for legibility — 2026-05-20
- "The Ballad of Doom Guy" lore overlay (scroll-icon header button, Esc/backdrop close); FS Access API browser-support guidance (Chrome/Edge work, Brave needs a flag) in the error + web/README — 2026-05-20
- Verified on James's machine: `npm run check` (tsc --noEmit) passes with 0 errors; `npm run build` (vite) succeeds. Only a chunk-size warning (pi-web-ui bundles all provider SDKs) — informational, optional code-split later — 2026-05-20
- Brave guidance pinned to the exact flag (brave://flags/#file-system-access-api) in web README + in-app message — 2026-05-20
- Custom-provider key auto-resolve: onApiKeyRequired mirrors a saved Ollama/custom key into providerKeys instead of re-prompting — 2026-05-20
- Action-first system prompt: agent now calls ls/read proactively instead of deflecting ("I can't access files"); confirmed working on Ollama models — 2026-05-20

## Backlog

- Phase 3b polish (tracked in `web/src/stbar.css` TODO block): @font-face for bundled
  OFL fonts, beveled buttons/inputs, STBAR scrollbars, HUD status footer, boot-sequence
  animation, tool-call card bevels
- Phase 3a — Terminal extension (`extension/`): ANSI re-skin per the locked mockup
- Phase 3c — Same-session storage bridge (Tauri filesystem access vs localhost daemon — deferred)
- Bundle OFL fonts into `fonts/` (needs James's consent before any download per supply-chain caution)
- Fonts section + agent-ask gate already in `README.md`

## Known issues / upstream

The pi-web-ui in this pi-mono HEAD expects an OLDER pi-agent-core event/state contract
than what ships. Three symptoms, all bridged from the app side in `web/src/main.ts`
(no vendored packages patched). The bundled pi-web-ui `example/` app likely has all three.
Worth flagging to pi maintainers.

1. **Vanishing messages** — pi-agent-core mutates `state.messages` in place (push); MessageList
   dirty-checks `messages` by reference, never re-renders. Workaround: poke `message-list.requestUpdate()`
   ea