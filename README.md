# pi-stbar

**STBAR** — a theme for [pi](https://pi.dev) (the `pi-coding-agent`) inspired by
id Software's *DOOM* (1993). Brown beveled HUD plates, signal colors, monospaced
type, and sharp corners — everywhere, always. It ships in two faces:

- **Terminal theme** — `stbar.json`, a 51-token color theme for pi's TUI.
- **Web face** — a browser app built on [`@earendil-works/pi-web-ui`](https://www.npmjs.com/package/@earendil-works/pi-web-ui),
  skinned with the full STBAR look: scanlines, vignette, beveled message plates,
  a six-cell status HUD, a UAC-style boot sequence, and the AmazDooM logo.

> **Not affiliated with or endorsed by id Software, ZeniMax Media, Bethesda, or
> Microsoft.** *DOOM* is a registered trademark of ZeniMax Media Inc. This is an
> independent, fan-made theme inspired by the visual language of the 1993 game.
> No original game assets are reproduced or distributed here. The name **STBAR**
> is the WAD lump that holds the original status-bar graphic — the brown HUD
> plate this whole look is built around.

## Screenshots

<p align="center">
  <img src="https://raw.githubusercontent.com/TheAmericanMaker/pi-stbar/main/media/hero.gif" alt="pi-stbar in action — boot sequence, chat, tool calls, and the STBAR HUD" width="820">
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/TheAmericanMaker/pi-stbar/main/media/session.png" alt="A pi-stbar session — message plates, a tool-call card, and the six-cell HUD" width="820">
</p>


<p align="center"><a href="https://github.com/TheAmericanMaker/pi-stbar/releases">▶ Watch the full demo</a></p>

## The five rules

1. No rounded corners. Anywhere. Ever.
2. Bevels: highlight top + left, shadow bottom + right. Invert for "pressed in."
3. Type is monospaced.
4. Color is signal — green = healthy, blue = info, yellow = warning, red = critical.
5. When in doubt: would it fit on a UAC monitor in 2145?

## Install — terminal theme

Drop the theme into pi, then select `stbar` in `/settings`:

```bash
# as a pi package (git)
pi install git:github.com/TheAmericanMaker/pi-stbar
# or npm
pi install npm:pi-stbar
```

Or copy `stbar.json` into `~/.pi/agent/themes/` and set `"theme": "stbar"` in
`settings.json`. For the closest match, set your terminal font to **IBM Plex Mono**
or **VT323** (see [FONTS.md](FONTS.md)).

## Run — web face

```bash
cd web
npm install
npm run dev      # http://localhost:5173
```

Add an API key (or a local provider like Ollama) via the settings cog. The agent
can chat, run JavaScript, render artifacts, and — in Chrome/Edge — read/write/edit
files in a folder you grant. See [`web/README.md`](web/README.md) for details,
browser support, and the Ollama notes.

## What's inside

| Path | What it is |
|---|---|
| `stbar.json` | The pi terminal theme (51 tokens). |
| `preview.html` | Static CSS preview of the palette + components. |
| `preview.ts` | Terminal preview (`npx tsx preview.ts`). |
| `web/` | The web face — Vite + Lit + Tailwind, on `pi-web-ui`. |
| `FONTS.md` | Font delivery + licenses. |
| `PLANNING.md`, `STYLING-CHECKLIST.md` | Design + status notes. |

## Credits

- Visual language honored: **id Software's** 1993 *DOOM* team.
- **AmazDooM** font by **Amazingmax** (free for personal/commercial use) — see [FONTS.md](FONTS.md).
- OFL fonts: IBM Plex Mono, VT323 (Peter Hull), Press Start 2P (CodeMan38), Black Ops One (Matt McInerney).
- Built on **pi** by Mario Zechner and the earendil-works packages.

## Roadmap

- **Terminal extension (Face 1)** — re-skin pi's in-terminal UI (ANSI HUD, beveled
  cards) to match the web face.
- **Same-session bridge** — share sessions between terminal pi and the web face.
- Persist the web face's granted folder across reloads.

## License

**MIT** for the code, theme, and docs — see [LICENSE](LICENSE). Bundled fonts keep
their own licenses — see [FONTS.md](FONTS.md).
