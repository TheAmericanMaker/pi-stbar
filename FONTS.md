# Fonts

pi-stbar uses five typefaces. How each is delivered, and its license:

## Bundled in this repo

- **AmazDooM** (`web/public/fonts/AmazDooM*.ttf`) — six faces by **Amazingmax**.
  Used for the display logo and headings. Free for personal and commercial use
  per the fontmeme.com listing. **Not covered by this repository's MIT license** —
  it retains Amazingmax's own terms. Source: <https://fontmeme.com/fonts/amazdoom-font/>.

## Pulled via npm (@fontsource), not committed

These install with `npm install` (in `web/`) and are bundled at build time. All
are **SIL Open Font License 1.1**:

- **IBM Plex Mono** — IBM. Body / code.
- **VT323** — Peter Hull. UI labels.
- **Press Start 2P** — CodeMan38. HUD numerics.
- **Black Ops One** — Matt McInerney. Display fallback for AmazDooM.

## Notes

- The web face references AmazDooM via `@font-face` in `web/src/stbar.css`
  (served from `web/public/fonts/`). If you remove the AmazDooM files, headings
  fall back to Black Ops One automatically.
- The pi terminal theme (`stbar.json`) is colors only and uses no bundled fonts —
  terminal type comes from your terminal emulator (IBM Plex Mono or VT323
  recommended).
