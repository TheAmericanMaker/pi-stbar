# pi-stbar — desktop face

The native desktop face of pi-stbar: the exact same STBAR-skinned `pi-web-ui`
agent as the [web face](../web), wrapped in [Tauri](https://tauri.app) so it
gets **full filesystem access and a real shell** — the terminal-pi parity the
browser sandbox can't give you.

There is one frontend. Tauri points at `../web`, and at runtime the app detects
the Tauri shell and swaps the browser File System Access tools for native ones:

| Tool | Web face (browser) | Desktop face (Tauri) |
|------|--------------------|----------------------|
| `ls` / `read` / `write` / `edit` | granted folder only, via File System Access API | anywhere on disk, via Rust |
| `bash` | — (browsers can't spawn processes) | **real shell** (`sh -c` / `cmd /C`) |
| folder button | grants a sandboxed folder | sets the working directory (defaults to your home dir) |

Relative paths from the agent resolve against the chosen working directory;
absolute paths are used as-is. The shell runs with its cwd set to that directory.

## Prerequisites

You need the web-face dependencies, plus the Rust toolchain and Tauri's system
libraries.

1. **Rust** — install via [rustup](https://rustup.rs).
2. **Node + npm** — for the frontend build.
3. **Tauri system dependencies:**
   - **Windows:** [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
     and **WebView2** (preinstalled on Windows 11 and most Windows 10).
   - **Fedora:**
     ```bash
     sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file \
       libappindicator-gtk3-devel librsvg2-devel gtk3-devel
     sudo dnf group install "c-development" "development-tools"
     ```

See the [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/) for
other platforms.

## Run it (dev)

```bash
cd web && npm install        # installs @tauri-apps/api + the frontend deps
cd ../desktop && npm install # installs the Tauri CLI
npm run dev                  # launches the desktop app
```

`npm run dev` runs `tauri dev`, which automatically starts the web Vite dev
server (`beforeDevCommand`) and opens the native window pointed at it. The first
run compiles the Rust crates and can take a few minutes; later runs are fast.

## Build installers

```bash
cd desktop
npm run build
```

Bundles land in `src-tauri/target/release/bundle/` — `.msi`/`.exe` on Windows,
`.rpm`/`.deb`/AppImage on Linux.

## First-run setup

Same as the web face: open the settings cog, add an API key for your provider
(or point at a local one like Ollama / LM Studio). Keys are stored locally. The
content security policy is disabled (`csp: null` in `tauri.conf.json`) so the
agent can reach arbitrary provider endpoints, including localhost.

## Providers & Ollama (no CORS setup needed)

Provider requests — local Ollama and cloud APIs alike — are routed through the
native HTTP client in Rust, not the webview. Because the request is made
server-side, there's no browser origin and CORS never applies. So **local Ollama
works out of the box**: no `OLLAMA_ORIGINS`, no CORS proxy, no flags.

(Local Ollama needs no API key either — pi treats it as an auto-discovery
provider and ignores the key field for local models. A key is only used for genuine
cloud APIs and Ollama's authenticated `:cloud` models.)

This bridge lives in `../web/src/tauri-tools.ts` (`installTauriFetch`) and only
activates inside the desktop app, for cross-origin requests; same-origin traffic
(app assets, dev HMR) uses the normal browser fetch. It's backed by
`tauri-plugin-http`, scoped in `src-tauri/capabilities/default.json`.

## Notes

- **Icons** are placeholders (a beveled STBAR panel with a `π` glyph). Replace
  them by dropping a square PNG and running `npm run tauri icon path/to/icon.png`.
- **No vendored packages are patched.** The three pi-web-ui / pi-agent-core
  contract workarounds live in `../web/src/main.ts`; see [`../PLANNING.md`](../PLANNING.md).
- The native backend commands are in [`src-tauri/src/lib.rs`](src-tauri/src/lib.rs);
  the typed frontend bridge is [`../web/src/tauri-tools.ts`](../web/src/tauri-tools.ts).
- This is a power tool: in the desktop face the agent can run shell commands and
  touch any file your user account can. Point the working directory at the
  project you want it to work in.
