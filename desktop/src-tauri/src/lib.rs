// ============================================================
// pi-stbar desktop — native backend commands.
//
// These mirror the web face's File System Access tools (ls/read/write/edit)
// but with NO browser sandbox: full filesystem access plus a real shell
// (shell_exec) — the terminal-pi parity that motivated the desktop face.
//
// Path model: the frontend tracks a "workspace root" (an absolute dir it
// gets from `default_dir` or `pick_dir`). Relative paths from the agent are
// resolved against that root; absolute paths are used as-is. The shell runs
// with its cwd set to the workspace root.
// ============================================================
use std::path::{Path, PathBuf};
use std::process::Command;

fn home_dir() -> String {
    #[cfg(windows)]
    {
        std::env::var("USERPROFILE").unwrap_or_else(|_| ".".to_string())
    }
    #[cfg(not(windows))]
    {
        std::env::var("HOME").unwrap_or_else(|_| ".".to_string())
    }
}

fn resolve(root: &str, path: &str) -> PathBuf {
    let p = Path::new(path);
    if p.is_absolute() {
        p.to_path_buf()
    } else {
        let base = if root.is_empty() { home_dir() } else { root.to_string() };
        Path::new(&base).join(path)
    }
}

#[tauri::command]
fn default_dir() -> String {
    home_dir()
}

#[tauri::command]
async fn pick_dir() -> Option<String> {
    rfd::AsyncFileDialog::new()
        .pick_folder()
        .await
        .map(|f| f.path().to_string_lossy().to_string())
}

#[tauri::command]
fn fs_ls(root: String, path: Option<String>) -> Result<String, String> {
    let dir = resolve(&root, &path.unwrap_or_else(|| ".".to_string()));
    let rd = std::fs::read_dir(&dir).map_err(|e| format!("ls {}: {}", dir.display(), e))?;
    let mut entries: Vec<String> = Vec::new();
    for ent in rd {
        let ent = ent.map_err(|e| e.to_string())?;
        let name = ent.file_name().to_string_lossy().to_string();
        let is_dir = ent.file_type().map(|t| t.is_dir()).unwrap_or(false);
        entries.push(if is_dir { format!("{}/", name) } else { name });
    }
    entries.sort();
    Ok(if entries.is_empty() {
        "(empty)".to_string()
    } else {
        entries.join("\n")
    })
}

#[tauri::command]
fn fs_read(root: String, path: String) -> Result<String, String> {
    let f = resolve(&root, &path);
    std::fs::read_to_string(&f).map_err(|e| format!("read {}: {}", f.display(), e))
}

#[tauri::command]
fn fs_write(root: String, path: String, content: String) -> Result<String, String> {
    let f = resolve(&root, &path);
    if let Some(parent) = f.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("mkdir {}: {}", parent.display(), e))?;
    }
    std::fs::write(&f, &content).map_err(|e| format!("write {}: {}", f.display(), e))?;
    Ok(format!("Wrote {} chars to {}", content.len(), path))
}

#[tauri::command]
fn fs_edit(root: String, path: String, old_text: String, new_text: String) -> Result<String, String> {
    let f = resolve(&root, &path);
    let original = std::fs::read_to_string(&f).map_err(|e| format!("read {}: {}", f.display(), e))?;
    let count = original.matches(&old_text).count();
    if count == 0 {
        return Err(format!("oldText not found in {}", path));
    }
    if count > 1 {
        return Err(format!("oldText occurs {} times in {}; make it unique.", count, path));
    }
    let updated = original.replacen(&old_text, &new_text, 1);
    std::fs::write(&f, updated).map_err(|e| format!("write {}: {}", f.display(), e))?;
    Ok(format!("Edited {}", path))
}

#[tauri::command]
fn shell_exec(root: String, command: String) -> Result<String, String> {
    let cwd = if root.is_empty() { home_dir() } else { root };
    let output = if cfg!(windows) {
        Command::new("cmd").args(["/C", &command]).current_dir(&cwd).output()
    } else {
        Command::new("sh").args(["-c", &command]).current_dir(&cwd).output()
    }
    .map_err(|e| format!("spawn failed: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let mut out = String::new();
    if !stdout.is_empty() {
        out.push_str(&stdout);
    }
    if !stderr.is_empty() {
        if !out.is_empty() {
            out.push('\n');
        }
        out.push_str(&stderr);
    }
    let code = output.status.code().unwrap_or(-1);
    if !output.status.success() {
        if !out.is_empty() {
            out.push('\n');
        }
        out.push_str(&format!("[exit {}]", code));
    }
    if out.trim().is_empty() {
        out = format!("[exit {}]", code);
    }
    Ok(out)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            default_dir,
            pick_dir,
            fs_ls,
            fs_read,
            fs_write,
            fs_edit,
            shell_exec
        ])
        .run(tauri::generate_context!())
        .expect("error while running pi-stbar desktop");
}
