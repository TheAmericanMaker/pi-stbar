#!/usr/bin/env node
/**
 * STBAR theme preview — renders a sample pi component-style scene
 * with the actual theme hex values so you can eyeball the palette
 * without booting pi. Run:
 *
 *   npx tsx preview.ts
 *
 * Requires `chalk` (peer of pi-tui).
 */
import chalk from "chalk";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

type ColorRef = string | number;

interface Theme {
	name: string;
	vars?: Record<string, ColorRef>;
	colors: Record<string, ColorRef>;
}

const here = dirname(fileURLToPath(import.meta.url));
const theme = JSON.parse(readFileSync(join(here, "stbar.json"), "utf8")) as Theme;

// Resolve a token (or var, or hex, or 256-index) to a chalk-callable fn.
function resolve(value: ColorRef): string {
	if (typeof value === "number") return ""; // 256-color preview skipped — use hex vars
	if (value === "") return "";
	if (value.startsWith("#")) return value;
	const v = theme.vars?.[value];
	if (v === undefined) return value;
	return resolve(v);
}
function fg(token: string): (s: string) => string {
	const hex = resolve(theme.colors[token]);
	return hex ? chalk.hex(hex) : (s) => s;
}
function bg(token: string): (s: string) => string {
	const hex = resolve(theme.colors[token]);
	return hex ? chalk.bgHex(hex) : (s) => s;
}
function fgVar(name: string): (s: string) => string {
	const hex = resolve(name);
	return hex ? chalk.hex(hex) : (s) => s;
}

const heading = fg("mdHeading");
const accent = fg("accent");
const ok = fg("success");
const warn = fg("warning");
const crit = fg("error");
const bone = fgVar("bone");
const dim = fg("muted");
const code = fg("mdCode");
const link = fg("mdLink");

const userBg = bg("userMessageBg");
const userFg = fg("userMessageText");
const successBoxBg = bg("toolSuccessBg");
const errorBoxBg = bg("toolErrorBg");

const W = 64;
const top = "┏" + "━".repeat(W - 2) + "┓";
const bot = "┗" + "━".repeat(W - 2) + "┛";
const mid = "┠" + "─".repeat(W - 2) + "┨";
function row(inner: string, width = W): string {
	// rough visible-width fit (ignores ANSI styling — fine for a preview)
	const stripped = inner.replace(/\x1b\[[0-9;]*m/g, "");
	const pad = Math.max(0, width - 4 - stripped.length);
	return "┃ " + inner + " ".repeat(pad) + " ┃";
}

console.log();
console.log(accent("  ▶ pi · stbar theme preview  ──  sharp corners, brown bevels, signal colors"));
console.log();

// Heading
console.log(heading(top));
console.log(heading(row(bone("PI · CODING AGENT") + dim("    [stbar]"))));
console.log(heading(row(dim("model: claude-sonnet-4-6        ctx 12%        $0.02"))));
console.log(heading(bot));
console.log();

// User message (panel brown background)
console.log(userBg(userFg(" ".repeat(W))));
console.log(userBg(userFg("  > Refactor the cache layer and add tests.".padEnd(W))));
console.log(userBg(userFg(" ".repeat(W))));
console.log();

// Markdown-style heading + body
console.log(heading("## Plan"));
console.log("Read " + code("src/cache.ts") + ", extract " + code("invalidate()") + ",");
console.log("then update " + link("docs/cache.md") + ".");
console.log();

// Tool boxes
console.log(successBoxBg(bone("  ✓ read   src/cache.ts                              42 lines  ".padEnd(W))));
console.log(successBoxBg(dim ("  + export function invalidate(key: string) { ... }                ".padEnd(W))));
console.log();
console.log(errorBoxBg(bone("  ✗ bash   npm test                                exit 1     ".padEnd(W))));
console.log(errorBoxBg(dim ("  FAIL  cache.test.ts  ›  invalidate clears entries                ".padEnd(W))));
console.log();

// Signal swatches
console.log(dim("  signal:  ") + ok("● healthy   ") + fg("mdLink")("● info   ") + warn("● warn   ") + crit("● critical"));
console.log();

// Thinking-level border ramp
const levels: Array<[string, string]> = [
	["off",      "thinkingOff"],
	["minimal",  "thinkingMinimal"],
	["low",      "thinkingLow"],
	["medium",   "thinkingMedium"],
	["high",     "thinkingHigh"],
	["xhigh",    "thinkingXhigh"],
];
console.log(dim("  thinking:"));
for (const [label, token] of levels) {
	const ramp = fg(token);
	console.log("  " + ramp("┃") + " " + label.padEnd(8) + " " + ramp("━".repeat(40)));
}
console.log();
console.log(dim("  STBAR-inspired · DOOM (1993) · UAC monitor, 2145"));
console.log();
