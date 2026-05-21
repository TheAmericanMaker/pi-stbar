# pi-stbar — web face

The browser face of pi-stbar: pi-web-ui's chat panel running on `pi-agent-core`,
skinned with STBAR (DOOM 1993-inspired) CSS. Same agent engine as terminal pi,
rendered with real bevels, scanlines, and signal colors.

## Run it

From the **pi-mono repo root** (not this folder):

```bash
npm install        # once
npm run build      # builds the workspace packages (pi-ai, pi-agent-core, pi-tui, pi-web-ui)
```

`npm run build` is required before the first run — the web app imports those
packages' compiled `dist/` output, which doesn't exist until you build. Then:

```bash
cd packages/stbar/web
npm run dev        # http://localhost:5173
```

## First-run setup

Open the settings cog (top-right) → add an API key for your provider, or
configure a local provider (Ollama, LM Studio, etc.). Keys live in your
browser's IndexedDB and are sent only to the provider's API.

The model selector:

- **Remembers your last-used model** — new threads default to it, no re-picking.
- **Lists only providers you've configured** — built-in providers you have a key
  for, plus your custom/local providers. Unconfigured providers are hidden.

## Using Ollama models (important)

The model selector discovers Ollama models from `ollama list` — it only sees
models that are **registered locally**. This matters for Ollama **cloud** models
(the `:cloud` tagged ones): you can chat with a cloud model in the Ollama app
without it ever appearing in `ollama list`, and in that case the web UI won't
show it either.

**If a model you use is missing from the selector, register it first:**

```bash
ollama pull <model>:cloud      # e.g. ollama pull kimi-k2.6:cloud
ollama list                     # confirm it now appears (cloud refs show size "-")
```

Then reload the web UI and reopen the selector — it'll be there. Any model that
reports a `tools` capability (`ollama show <model>` → Capabilities) and appears
in `ollama list` will be discovered. Models without a `tools` capability are
filtered out (the agent needs tool-calling).

## Notes

- This is the "web face" of the two-faces design (terminal extension is the other).
  See [`../PLANNING.md`](../PLANNING.md) for status and the pi-web-ui/pi-agent-core
  integration workarounds living in `src/main.ts`.
- Sessions are stored per-browser in IndexedDB. Sharing sessions with terminal pi
  (the same-session bridge) is a separate, deferred phase.

## Working with files

The agent can read/write/edit files in a folder you grant via the **folder button**
in the header (tools: `ls`, `read`, `write`, `edit`, scoped to that folder). This uses
the browser's File System Access API. There is no shell — browsers can't spawn
processes — so it's file editing only, not `bash`/`git`/builds.

Browser support:

- **Chrome / Edge** — works out of the box. (Confirmed.)
- **Brave** — the API is disabled by default. Enable the `#file-system-access-api`
  flag at `brave://flags/#file-system-access-api`, restart Brave, then use the folder button.
- **Firefox / Safari** — not supported; the folder button will show a notice.

The granted folder is held for the session only — after a page reload you click the
folder button again. (Persisting the grant across reloads is a possible follow-up.)
