// ============================================================
// Native (Tauri) file + shell tools for the pi-stbar DESKTOP face.
//
// When the web app runs inside the Tauri desktop shell, it gets full
// native filesystem access AND a real shell — no browser sandbox, no
// folder grant required. These tools mirror the File System Access
// versions in fs-tools.ts (same names/labels) so the agent behaves
// identically across faces, and add a `bash` tool for shell parity
// with terminal pi.
//
// All work is done by Rust commands (see desktop/src-tauri/src/lib.rs);
// this module is just the typed bridge. Paths are resolved against a
// "workspace root" the frontend tracks (default: the user's home dir;
// changed via the folder button -> pick_dir). Absolute paths are used
// as-is. The shell runs with its cwd set to the workspace root.
// ============================================================
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { type Static, Type } from "typebox";

// Detect the Tauri runtime. v2 injects __TAURI_INTERNALS__ on window.
export function isTauri(): boolean {
	return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// Lazily import the Tauri API only when actually running under Tauri,
// so the pure-web bundle never touches it at call time.
async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
	const core = await import("@tauri-apps/api/core");
	return core.invoke<T>(cmd, args);
}

let workspaceRoot = "";
let workspaceName = "";

function basename(p: string): string {
	const cleaned = p.replace(/[\\/]+$/, "");
	const parts = cleaned.split(/[\\/]/);
	return parts[parts.length - 1] || cleaned || p;
}

export function getTauriWorkspaceName(): string {
	return workspaceName;
}
export function hasTauriWorkspace(): boolean {
	return Boolean(workspaceRoot);
}

// Seed the workspace root from the user's home dir on startup so the
// agent has somewhere to operate before the user picks a folder.
export async function initTauriWorkspace(): Promise<void> {
	if (!isTauri() || workspaceRoot) return;
	try {
		workspaceRoot = await invoke<string>("default_dir");
		workspaceName = basename(workspaceRoot);
	} catch {
		// non-fatal: tools still work with absolute paths
	}
}

// Open a native folder picker and set it as the workspace root + shell cwd.
export async function pickTauriFolder(): Promise<boolean> {
	const picked = await invoke<string | null>("pick_dir");
	if (!picked) return false; // user cancelled
	workspaceRoot = picked;
	workspaceName = basename(picked);
	return true;
}

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }], details: {} });

const lsSchema = Type.Object({
	path: Type.Optional(Type.String({ description: "Directory path, relative to the workspace root or absolute. Omit or '.' for the root." })),
});
const readSchema = Type.Object({
	path: Type.String({ description: "File path, relative to the workspace root or absolute, e.g. 'src/app.ts'." }),
});
const writeSchema = Type.Object({
	path: Type.String({ description: "File path, relative to the workspace root or absolute. Parent dirs are created as needed." }),
	content: Type.String({ description: "Full file contents to write." }),
});
const editSchema = Type.Object({
	path: Type.String({ description: "File path, relative to the workspace root or absolute." }),
	oldText: Type.String({ description: "Exact text to find. Must occur exactly once in the file." }),
	newText: Type.String({ description: "Replacement text." }),
});
const bashSchema = Type.Object({
	command: Type.String({ description: "Shell command to run. Executed with the workspace root as the working directory. Real shell — git, build tools, etc. are available." }),
});

export function createTauriTools(): AgentTool[] {
	const ls: AgentTool<typeof lsSchema> = {
		name: "ls",
		label: "SCAN",
		description: "List files and folders in a directory on the local filesystem.",
		parameters: lsSchema,
		executionMode: "parallel",
		execute: async (_id: string, args: Static<typeof lsSchema>) => {
			const out = await invoke<string>("fs_ls", { root: workspaceRoot, path: args.path ?? "." });
			return text(out);
		},
	};

	const read: AgentTool<typeof readSchema> = {
		name: "read",
		label: "READ",
		description: "Read the full contents of a file on the local filesystem.",
		parameters: readSchema,
		executionMode: "parallel",
		execute: async (_id: string, args: Static<typeof readSchema>) => {
			const out = await invoke<string>("fs_read", { root: workspaceRoot, path: args.path });
			return text(out);
		},
	};

	const write: AgentTool<typeof writeSchema> = {
		name: "write",
		label: "INSCRIBE",
		description: "Create or overwrite a file on the local filesystem. Parent directories are created as needed.",
		parameters: writeSchema,
		executionMode: "sequential",
		execute: async (_id: string, args: Static<typeof writeSchema>) => {
			const out = await invoke<string>("fs_write", { root: workspaceRoot, path: args.path, content: args.content });
			return text(out);
		},
	};

	const edit: AgentTool<typeof editSchema> = {
		name: "edit",
		label: "MODIFY",
		description: "Replace an exact, unique snippet of text in a file on the local filesystem.",
		parameters: editSchema,
		executionMode: "sequential",
		execute: async (_id: string, args: Static<typeof editSchema>) => {
			const out = await invoke<string>("fs_edit", {
				root: workspaceRoot,
				path: args.path,
				oldText: args.oldText,
				newText: args.newText,
			});
			return text(out);
		},
	};

	const bash: AgentTool<typeof bashSchema> = {
		name: "bash",
		label: "EXEC",
		description: "Run a shell command on the local machine (cwd = workspace root). Use for git, builds, tests, and any task beyond plain file editing.",
		parameters: bashSchema,
		executionMode: "sequential",
		execute: async (_id: string, args: Static<typeof bashSchema>) => {
			const out = await invoke<string>("shell_exec", { root: workspaceRoot, command: args.command });
			return text(out);
		},
	};

	return [ls, read, write, edit, bash];
}
