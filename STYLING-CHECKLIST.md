# pi-stbar web face — visual interface build checklist

Every STBAR design element mapped to the pi-web-ui surface it skins. Source designs:
`packages/stbar/preview.html`, and the STBAR system (`doom.css`, `style-guide.html`,
`demo.html`, `doom-tui.md`) in `Documents/Claude/Projects/STBAR`.

Five rules apply to every item: (1) no rounded corners, ever; (2) bevels = highlight
top+left, shadow bottom+right, inverted for pressed-in surfaces; (3) monospaced type;
(4) color is signal — green healthy / blue info / yellow warning / red critical;
(5) would it fit on a UAC monitor in 2145?

---

## 1. Foundations

- [ ] **1.1 Design tokens** — single source of truth, mirror `stbar.json`
  - [ ] Surface ramp: void `#0a0a0a`, stone `#1a1715`, iron `#2a2522`, grate `#15110e`
  - [ ] Panel ramp: panel-light `#7a5e3c`, panel `#4a3a2a`, panel-deep `#38291c`, panel-dark `#251a10`
  - [ ] Signal: blood `#b51d0e`, blood-bright `#e8341a`, hellfire `#f96e1f`, flare `#ffb347`, marine `#36a330`, armor `#1e5fb8`, key-yellow `#f0c20c`, toxic `#7ad932`, rust `#8b4513`
  - [ ] Type: bone `#e8dcc4`, bone-dim `#b8a886`, ash `#6e655a`
  - [ ] Bevel weights: 2 / 4 / 6px
  - [ ] Remap pi-web-ui/mini-lit theme vars onto these (background, foreground, card, primary, border, input, ring, etc.) — *done in `stbar.css` v1*
- [ ] **1.2 Fonts** (`@font-face` + fallback chain; resolve sourcing per supply-chain note)
  - [ ] Body — IBM Plex Mono (fallback Courier New, ui-monospace)
  - [ ] UI labels — VT323 (uppercase, wide tracking)
  - [ ] HUD numerics — Press Start 2P (stat readouts)
  - [ ] Display / headings — AmazDooM (fallback Black Ops One, Rubik Mono One)
  - [ ] Typewriter / diegetic notes — Special Elite
  - [ ] Disable subpixel smoothing (`-webkit-font-smoothing: none`) for crunchy edges
- [ ] **1.3 Global treatments**
  - [ ] Scanlines overlay (fixed, repeating-linear-gradient, multiply blend) — *wired, verify over pi-web-ui content*
  - [ ] Vignette overlay (radial, fixed) — *wired, verify*
  - [ ] Tiled stone texture on body background — *wired*
  - [ ] `border-radius: 0` enforced everywhere — *done*
  - [ ] `::selection` = blood bg / bone text
  - [ ] Custom scrollbars — panel-brown thumb on grate track (replace pi-web-ui's gray)
  - [ ] CRT flicker / chromatic aberration (optional, sparingly)

## 2. App shell / chrome

- [ ] **2.1 Header bar** (the top strip — currently plain)
  - [ ] Brown beveled HUD plate background (raised bevel), per `demo.html` `.topbar`
  - [ ] STBAR logo treatment (AmazDooM wordmark, or block-art banner)
  - [ ] Subtitle line — "UAC tactical terminal" style, VT323, bone-dim, wide tracking
  - [ ] Status strip — connection dot (marine-green, glow), session/zone, model, clock, `│` separators
  - [ ] Session (history) + New buttons → `.doom-btn--ghost`
  - [ ] Editable title field → inset-bevel input treatment
  - [ ] Theme toggle + settings cog → ghost buttons
- [ ] **2.2 Footer → Status HUD** (replace/augment the token-usage line)
  - [ ] Six-cell STBAR plate (recessed cavities on brown plate) per `#hud`
  - [ ] HEALTH cell = context remaining %, green→yellow→red as it drains, pulse when critical
  - [ ] ARMOR cell = cost (armor-blue)
  - [ ] AMMO cell = tokens up/down (key-yellow)
  - [ ] WEAPON cell = active model (bone)
  - [ ] ZONE cell = cwd / session name (bone)
  - [ ] THREAT cell = error state, blood-bright `!!`, pulse on last-turn error
  - [ ] VT323 labels + Press Start 2P values

## 3. Message stream

- [ ] **3.1 User messages** (`.user-message-container`) — *base override done; refine*
  - [ ] Brown panel-deep plate, raised bevel, bone text
  - [ ] `► OPERATOR` cap label (VT323, optional/tunable lore voice)
  - [ ] Attachment tiles → inset mini-plates
- [ ] **3.2 Assistant messages** (`assistant-message`, markdown body)
  - [ ] System-log treatment — console prefix (`►`), toxic/bone body on subtle plate
  - [ ] Markdown primitives (see §6)
  - [ ] Usage/cost line per message → ash, small
- [ ] **3.3 Streaming message container** — in-progress assistant turn
  - [ ] Same treatment as committed assistant message (no visual jump on commit)
  - [ ] Caret / cursor blip while streaming
- [ ] **3.4 Tool-call cards** (pending / success / error boxes)
  - [ ] Beveled slot-card (per `demo.html` loadout slots + armory plate)
  - [ ] Status cap: `[ OK ]` marine-green (success), `[ CRIT ]` blood-bright (error), pulsing ash dot (pending)
  - [ ] Tool-name label, optionally mission-verb mapped (read→READ, bash→EXEC, write→INSCRIBE, edit→MODIFY, grep/find→SCAN)
  - [ ] Mid-card separator rule (mixed-weight, like the ARMORY plate)
  - [ ] Tool output region → inset grate cavity, toxic-green
  - [ ] Diff rendering — added marine-green, removed blood-bright, context ash
  - [ ] Collapse/expand affordance → ghost button
- [ ] **3.5 Thinking blocks** (`ThinkingBlock`)
  - [ ] Recessed/inset stone plate, bone-dim italic-ish, "SCANNING…" framing
  - [ ] Shimmer animation reskinned to a scanline sweep
- [ ] **3.6 System / custom messages → Alerts**
  - [ ] Default alert — blood theme (per `.doom-alert`)
  - [ ] Warn alert — key-yellow (`.doom-alert--warn`)
  - [ ] OK alert — marine-green (`.doom-alert--ok`)
  - [ ] Colored bevel caps + uppercase + `[CRIT]/[WARN]/[ OK ]` prefixes
- [ ] **3.7 Loader / working indicator**
  - [ ] Replace spinner with rotating crosshair (`╋ ╳`) or radar sweep
  - [ ] "SCANNING TARGETS / WORKING" label, key-yellow
  - [ ] Optional: radar sweep animating across the editor's top border during tool runs

## 4. Editor / input area

- [ ] **4.1 Textarea** (`message-editor`) — inset bevel (carved into plate), grate bg, bone text, ash placeholder
- [ ] **4.2 Action buttons** — send / abort / attach → beveled buttons; send = fire, abort = blood
- [ ] **4.3 Selectors** — model trigger + thinking trigger → ghost buttons with VT323 labels
- [ ] **4.4 Editor border = thinking-level signal** (carry the existing token mapping)
  - [ ] off ash · minimal bone-dim · low armor-blue · medium key-yellow · high hellfire · xhigh blood-bright
  - [ ] Bash mode (`!`) flips border to toxic-green
- [ ] **4.5 Autocomplete / slash-command popups** → inset panel, selected row = blood plate

## 5. Dialogs / overlays

- [ ] **5.1 Model selector** — stone/iron dialog plate; rows as recessed cavities; selected row blood cap; search input inset; capability filter chips → tags
- [ ] **5.2 Settings dialog** (Providers/Models, Proxy tabs) — beveled tabs, inset fields, ghost/fire buttons
- [ ] **5.3 Session list dialog** — rows as slot tiles, hover = blood tint, delete = blood ghost
- [ ] **5.4 API-key prompt** — inset input, fire confirm button, blood cancel
- [ ] **5.5 Dialog backdrop** — darken + vignette intensify; sharp-cornered modal plate (stone panel)

## 6. Markdown content primitives (inside messages)

- [ ] H1/H2 — AmazDooM, blood/hellfire, chiseled text-shadow stack — *base done*
- [ ] H3/H4 — VT323 uppercase, wide tracking, bone
- [ ] Inline `code` — toxic-green on grate, panel-dark border — *done*
- [ ] Code block `pre` — grate bg, blood left-rule, toxic text — *done*
- [ ] Syntax highlighting — keyword hellfire, function key-yellow, variable armor, string toxic, number flare, type marine, comment ash
- [ ] Links — hellfire, dotted underline, blood-bright + glow on hover — *done*
- [ ] Blockquote — bone-dim text, blood left-border
- [ ] Lists — hellfire bullets/markers
- [ ] Tables (`.doom-table`) — grate bg, panel header row, blood-tint row hover, gridded
- [ ] Horizontal rule — beveled two-tone line, or `.doom-divider` ornament with label
- [ ] Images / embedded media — sharp-cornered, panel-dark frame

## 7. Artifacts panel (HTML / SVG / Markdown / sandbox)

- [ ] Panel chrome — iron plate, beveled, tabbed header as slot tiles
- [ ] Artifact frame — sharp corners, panel-dark border
- [ ] Console output region (`ConsoleBlock`) — grate cavity, toxic-green, ash timestamps
- [ ] Run/copy/download controls → ghost buttons

## 8. Micro-interactions & motion

- [ ] Button press — invert bevel + nudge 1px down/right (the "feel the click")
- [ ] Critical states pulse (`doom-pulse` keyframes) — low context, errors, threat cell
- [ ] Bar fills animate width with glow
- [ ] Hover glows on interactive text (fire/blood text-shadow), used sparingly
- [ ] Boot-sequence on first paint — typed "UAC-NET: connection established…" log reveal
- [ ] Optional terminal `\a`-style audio cue on error (respect reduced-motion / mute)
- [ ] Respect `prefers-reduced-motion` — disable pulses/sweeps when set

## 9. Voice / copy (tunable, default-on lore)

- [ ] Loading / empty / error strings in marine-radio cadence (imperative, all-caps verbs)
- [ ] Empty-session state — "AWAITING ORDERS" style
- [ ] Error copy — "CONTAINMENT BREACH" register (toggle for plain "ERROR")
- [ ] No emoji, no corporate softening (per STBAR voice rules)

## 10. Verification

- [ ] Visual pass against `demo.html` / `style-guide.html` side by side
- [ ] Contrast check — every text token ≥ readable on its surface (WCAG-ish; we already hit one dim-on-void bug)
- [ ] Light-terminal / light-mode sanity (theme toggle still present)
- [ ] `prefers-reduced-motion` honored
- [ ] No rounded corners anywhere (audit)
- [ ] Screenshot review with James at each major surface
