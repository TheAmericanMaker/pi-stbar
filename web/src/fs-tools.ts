// ============================================================
// File System Access API tools for the pi-stbar web agent.
//
// The browser sandbox blocks arbitrary file access, but the File System
// Access API (Chrome/Edge) lets the user GRANT a folder, after which the
// page gets real read/write handles into that tree. These tools operate
// strictly within the granted folder. There is no shell — browsers can't
// spawn processes — so this is read/write/edit/ls only.
// ============================================================
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { type Static, Type } from "typebox";

// The granted workspace directory handle (kept in memory for the session).
let rootHandle: any | undefined;
let rootName = "";

export function getWorkspaceName(): string {
	return rootName;
}
export function hasWorkspace(): boolean {
	return Boolean(rootHandle);
}

// Prompt the user to grant read+write access to a folder.
export async function pickWorkspaceFolder(): Promise<boolean> {
	const picker = (window as any).showDirectoryPicker;
	if (typeof picker !== "function") {
		alert(
			"File access needs the File System Access API.\n\n" +
				"\u2022 Chrome / Edge: works out of the box.\n" +
				"\u2022 Brave: disabled by default \u2014 enable the #file-system-access-api flag at brave://flags/#file-system-access-api, then restart Brave.\n" +
				"\u2022 Firefox / Safari: not supported.",
		);
		return false;
	}
	try {
		const handle = await picker({ mode: "readwrite" });
		if ((await handle.queryPermission?.({ mode: "readwrite" })) !== "granted") {
			const perm = await handle.requestPermission?.({ mode: "readwrite" });
			if (perm !== "granted") return false;
		}
		rootHandle = handle;
		rootName = handle.name;
		return true;
	} catch {
		return false; // user cancelled the picker
	}
}

function requireRoot(): any {
	if (!rootHandle) {
		throw new Error("No workspace folder granted. Click the folder button in the header to grant access first.");
	}
	return rootHandle;
}

function splitPath(path: string): string[] {
	return path.split("/").filter((p) => p && p !== ".");
}

async function getDirHandle(path: string, create = false): Promise<any> {
	let dir = requireRoot();
	for (const part of splitPath(path)) {
		dir = await dir.getDirectoryHandle(part, { create });
	}
	return dir;
}

async function resolveParent(path: string, create: boolean): Promise<{ dir: any; name: string }> {
	const parts = splitPath(path);
	if (parts.length === 0) throw new Error("Empty path");
	let dir = requireRoot();
	for (let i = 0; i < parts.length - 1; i++) {
		dir = await dir.getDirectoryHandle(parts[i], { create });
	}
	return { dir, name: parts[parts.length - 1] };
}

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }], details: {} });

const lsSchema = Type.Object({
	path: Type.Optional(Type.String({ description: "Directory path relative to the workspace root. Omit or '.' for the root." })),
});
const readSchema = Type.Object({
	path: Type.String({ description: "File path relative to the workspace root, e.g. 'src/app.ts'." }),
});
const writeSchema = Type.Object({
	path: Type.String({ description: "File path relative to the workspace root. Parent dirs are created as needed." }),
	content: Type.String({ description: "Full file contents to write." }),
});
const editSchema = Type.Object({
	path: Type.String({ description: "File path relative to the workspace root." }),
	oldText: Type.String({ description: "Exact text to find. Must occur exactly once in the file." }),
	newText: Type.String({ description: "Replacement text." }),
});

export function createFsTools(): AgentTool[] {
	const ls: AgentTool<typeof lsSchema> = {
		name: "ls",
		label: "SCAN",
		description: "List files and folders in a directory within the granted workspace folder.",
		parameters: lsSchema,
		executionMode: "parallel",
		execute: async (_id: string, args: Static<typeof lsSchema>) => {
			const dir = await getDirHandle(args.path ?? ".");
			const entries: string[] = [];
			for await (const [name, handle] of (dir as any).entries()) {
				entries.push(handle.kind === "directory" ? `${name}/` : name);
			}
			entries.sort();
			return text(entries.length ? entries.join("\n") : "(empty)");
		},
	};

	const read: AgentTool<typeof readSchema> = {
		name: "read",
		label: "READ",
		description: "Read the full contents of a file within the granted workspace folder.",
		parameters: readSchema,
		executionMode: "parallel",
		execute: async (_id: string, args: Static<typeof readSchema>) => {
			const { dir, name } = await resolveParent(args.path, false);
			const fileHandle = await dir.getFileHandle(name);
			const file = await fileHandle.getFile();
			return text(await file.text());
		},
	};

	const write: AgentTool<typeof writeSchema> = {
		name: "write",
		label: "INSCRIBE",
		description: "Create or overwrite a file within the granted workspace folder. Parent directories are created as needed.",
		parameters: writeSchema,
		executionMode: "sequential",
		execute: async (_id: string, args: Static<typeof writeSchema>) => {
			const { dir, name } = await resolveParent(args.path, true);
			const fileHandle = await dir.getFileHandle(name, { create: true });
			const writable = await fileHandle.createWritable();
			await writable.write(args.content);
			await writable.close();
			return text(`Wrote ${args.content.length} chars to ${args.path}`);
		},
	};

	const edit: AgentTool<typeof editSchema> = {
		name: "edit",
		label: "MODIFY",
		description: "Replace an exact, unique snippet of text in a file within the granted workspace folder.",
		parameters: editSchema,
		executionMode: "sequential",
		execute: async (_id: string, args: Static<typeof editSchema>) => {
			const { dir, name } = await resolveParent(args.path, false);
			const fileHandle = await dir.getFileHandle(name);
			const original = await (await fileHandle.getFile()).text();
			const count = original.split(args.oldText).length - 1;
			if (count === 0) throw new Error(`oldText not found in ${args.path}`);
			if (count > 1) throw new Error(`oldText occurs ${count} times in ${args.path}; make it unique.`);
			const updated = original.replace(args.oldText, args.newText);
			const writable = await fileHandle.createWritable();
			await writable.write(updated);
			await writable.close();
			return text(`Edited ${args.path}`);
		},
	};

	return [ls, read, write, edit];
}
