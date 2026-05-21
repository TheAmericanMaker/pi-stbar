import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [tailwindcss()],
	// Pinned so the Tauri desktop shell's devUrl (5173) always resolves.
	clearScreen: false,
	server: {
		port: 5173,
		strictPort: true,
	},
});
