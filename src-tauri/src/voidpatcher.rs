use serde::Serialize;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Stdio};
use std::sync::{Mutex, OnceLock};

const HOST_EXE: &str = "ltk_patcher_host.exe";
const HOST_DLL: &str = "ltk_patcher_dll.dll";

pub const LOG_LEVEL_ERROR: u32 = 0;
pub const LOG_LEVEL_INFO: u32 = 0x10;
pub const LOG_LEVEL_DEBUG: u32 = 0x20;
pub const LOG_LEVEL_ALL: u32 = 0x1000;

pub const HOOK_DISABLE_VERIFY: u32 = 1;
pub const HOOK_DISABLE_FILE: u32 = 2;
pub const HOOK_OPT_OUT_AH_V1: u32 = 4;
pub const HOOK_FULL_WAD_SCAN: u32 = 8;

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct PatcherStatus {
    pub available: bool,
    pub host_path: Option<String>,
    pub dll_path: Option<String>,
    pub source: String,
    pub running: bool,
    pub state: String,
    pub last_message: String,
    pub log_count: usize,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PatcherEvent {
    pub kind: String,
    pub timestamp: String,
    pub state: Option<String>,
    pub level: Option<String>,
    pub message: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PatcherOption {
    pub value: u32,
    pub label: String,
    pub description: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PatcherConfig {
    pub log_levels: Vec<PatcherOption>,
    pub hook_flags: Vec<PatcherOption>,
    pub default_flags: u32,
}

pub fn config() -> PatcherConfig {
    PatcherConfig {
        log_levels: vec![
            PatcherOption {
                value: LOG_LEVEL_ERROR,
                label: "Hata".to_string(),
                description: "Yalnızca hatalar".to_string(),
            },
            PatcherOption {
                value: LOG_LEVEL_INFO,
                label: "Bilgi".to_string(),
                description: "Bilgi mesajları".to_string(),
            },
            PatcherOption {
                value: LOG_LEVEL_DEBUG,
                label: "Hata ayıklama".to_string(),
                description: "Ayrıntılı hata ayıklama çıktısı".to_string(),
            },
            PatcherOption {
                value: LOG_LEVEL_ALL,
                label: "Tümü".to_string(),
                description: "Tüm log kayıtları".to_string(),
            },
        ],
        hook_flags: vec![
            PatcherOption {
                value: HOOK_DISABLE_VERIFY,
                label: "Doğrulamayı kapat".to_string(),
                description: "Oyunun kendi dosya doğrulaması devrede kalır".to_string(),
            },
            PatcherOption {
                value: HOOK_DISABLE_FILE,
                label: "Dosya yönlendirmesini kapat".to_string(),
                description: "Overlay dosyaları oyuna yönlendirilmez".to_string(),
            },
            PatcherOption {
                value: HOOK_OPT_OUT_AH_V1,
                label: "Anti-skinhack'i gevşet".to_string(),
                description: "Başarısız WAD taraması hata yerine uyarı olur".to_string(),
            },
            PatcherOption {
                value: HOOK_FULL_WAD_SCAN,
                label: "Tam WAD taraması".to_string(),
                description: "Tüm arşivler baştan taranır".to_string(),
            },
        ],
        default_flags: HOOK_OPT_OUT_AH_V1,
    }
}

struct Runtime {
    state: String,
    last_message: String,
    logs: Vec<String>,
}

struct Session {
    child: Child,
    stdin: ChildStdin,
}

fn runtime() -> &'static Mutex<Runtime> {
    static RUNTIME: OnceLock<Mutex<Runtime>> = OnceLock::new();
    RUNTIME.get_or_init(|| {
        Mutex::new(Runtime {
            state: "idle".to_string(),
            last_message: String::new(),
            logs: Vec::new(),
        })
    })
}

fn session() -> &'static Mutex<Option<Session>> {
    static SESSION: OnceLock<Mutex<Option<Session>>> = OnceLock::new();
    SESSION.get_or_init(|| Mutex::new(None))
}

fn candidate_dirs() -> Vec<PathBuf> {
    let mut out: Vec<PathBuf> = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            out.push(dir.join("patcher"));
            out.push(dir.to_path_buf());
        }
    }
    if let Some(local) = std::env::var_os("LOCALAPPDATA") {
        let base = PathBuf::from(local);
        out.push(base.join("VOID").join("patcher"));
        out.push(base.join("LTK Manager"));
        out.push(base.join("Programs").join("LTK Manager"));
    }
    if let Some(pf) = std::env::var_os("ProgramFiles") {
        out.push(PathBuf::from(pf).join("LTK Manager"));
    }
    if let Some(pf) = std::env::var_os("ProgramFiles(x86)") {
        out.push(PathBuf::from(pf).join("LTK Manager"));
    }
    if let Some(appdata) = std::env::var_os("APPDATA") {
        out.push(PathBuf::from(appdata).join("VOID").join("patcher"));
    }
    out
}

fn locate() -> Option<(PathBuf, PathBuf)> {
    for dir in candidate_dirs() {
        let host = dir.join(HOST_EXE);
        let dll = dir.join(HOST_DLL);
        if host.is_file() && dll.is_file() {
            return Some((host, dll));
        }
    }
    None
}

pub fn status() -> PatcherStatus {
    let found = locate();
    let available = found.is_some();
    let (host_path, dll_path) = match found {
        Some((host, dll)) => (
            Some(host.to_string_lossy().to_string()),
            Some(dll.to_string_lossy().to_string()),
        ),
        None => (None, None),
    };
    let running = session()
        .lock()
        .ok()
        .and_then(|mut s| s.as_mut().map(|s| s.child.try_wait().ok().flatten().is_none()))
        .unwrap_or(false);
    let (state, last_message, log_count) = match runtime().lock() {
        Ok(rt) => (rt.state.clone(), rt.last_message.clone(), rt.logs.len()),
        Err(_) => ("idle".to_string(), String::new(), 0),
    };
    PatcherStatus {
        available,
        host_path,
        dll_path,
        source: "host".to_string(),
        running,
        state,
        last_message,
        log_count,
    }
}

fn set_state(state: &str, message: &str) {
    if let Ok(mut rt) = runtime().lock() {
        rt.state = state.to_string();
        rt.last_message = message.to_string();
    }
}

fn push_log(message: &str) {
    if let Ok(mut rt) = runtime().lock() {
        rt.logs.push(message.to_string());
        if rt.logs.len() > 500 {
            let excess = rt.logs.len() - 500;
            rt.logs.drain(0..excess);
        }
    }
}

fn split_token(text: &str) -> Option<(String, &str)> {
    let text = text.trim_start();
    match text.find(' ') {
        Some(pos) => Some((text[..pos].to_string(), text[pos + 1..].trim_start())),
        None => Some((text.to_string(), "")),
    }
}

fn parse_event(line: &str) -> Option<PatcherEvent> {
    let line = line.trim();
    if line.is_empty() {
        return None;
    }
    let mut parts = line.splitn(2, ' ');
    let keyword = parts.next()?;
    let rest = parts.next().unwrap_or("");

    match keyword {
        "ok" => {
            let (timestamp, message) = split_token(rest)?;
            Some(PatcherEvent {
                kind: "ok".to_string(),
                timestamp,
                state: None,
                level: None,
                message: message.to_string(),
            })
        }
        "status" => {
            let (timestamp, rest) = split_token(rest)?;
            let (state, message) = split_token(rest)?;
            Some(PatcherEvent {
                kind: "status".to_string(),
                timestamp,
                state: Some(state),
                level: None,
                message: message.to_string(),
            })
        }
        "error" => {
            let (timestamp, message) = split_token(rest)?;
            Some(PatcherEvent {
                kind: "error".to_string(),
                timestamp,
                state: None,
                level: None,
                message: message.to_string(),
            })
        }
        "dll" => {
            let (timestamp, rest) = split_token(rest)?;
            let (pid, rest) = split_token(rest)?;
            let (tid, rest) = split_token(rest)?;
            let (level, message) = split_token(rest)?;
            Some(PatcherEvent {
                kind: "dll".to_string(),
                timestamp,
                state: None,
                level: Some(level),
                message: format!("[pid {pid} tid {tid}] {message}"),
            })
        }
        _ => None,
    }
}

fn emit(app: &tauri::AppHandle, event: PatcherEvent) {
    use tauri::Emitter;
    if let Some(state) = &event.state {
        set_state(state, &event.message);
    } else if event.kind == "error" {
        set_state("failed", &event.message);
    } else if event.kind == "ok" {
        set_state("ok", &event.message);
    }
    if event.kind == "dll" || event.kind == "error" {
        push_log(&event.message);
    }
    let _ = app.emit("void-patcher-event", event);
}

fn read_stream<R: std::io::Read + Send + 'static>(
    reader: R,
    app: tauri::AppHandle,
    kind: &'static str,
) {
    let reader = BufReader::new(reader);
    for line in reader.lines() {
        let Ok(line) = line else { break };
        if kind == "log" {
            let event = PatcherEvent {
                kind: "log".to_string(),
                timestamp: String::new(),
                state: None,
                level: None,
                message: line.clone(),
            };
            push_log(&line);
            use tauri::Emitter;
            let _ = app.emit("void-patcher-event", event);
            continue;
        }
        if let Some(event) = parse_event(&line) {
            emit(&app, event);
        }
    }
}

pub fn normalize_prefix(path: &Path) -> String {
    let mut text = path.to_string_lossy().to_string();
    if !text.ends_with('\\') && !text.ends_with('/') {
        text.push('\\');
    }
    text
}

pub fn start(
    app: tauri::AppHandle,
    prefix: &str,
    log_level: u32,
    flags: u32,
) -> Result<PatcherStatus, String> {
    let (host, _dll) = locate().ok_or_else(|| {
        "Patcher binary'leri bulunamadı. ltk_patcher_host.exe ve ltk_patcher_dll.dll dosyalarını \
         VOID klasörüne (ya da %LOCALAPPDATA%\\VOID\\patcher içine) kopyalayın."
            .to_string()
    })?;

    {
        let mut guard = session().lock().map_err(|_| "Patcher durumu okunamadı.".to_string())?;
        if let Some(active) = guard.as_mut() {
            if active.child.try_wait().ok().flatten().is_none() {
                return Err("Patcher zaten çalışıyor.".to_string());
            }
        }
    }

    let mut cmd = crate::command(&host);
    if let Some(dir) = host.parent() {
        cmd.current_dir(dir);
    }
    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Patcher başlatılamadı: {e}"))?;
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Patcher standart girdisi alınamadı.".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Patcher standart çıktısı alınamadı.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Patcher hata çıktısı alınamadı.".to_string())?;

    let out_app = app.clone();
    std::thread::spawn(move || read_stream(stdout, out_app, "event"));
    let err_app = app.clone();
    std::thread::spawn(move || read_stream(stderr, err_app, "log"));

    let mut writer = stdin;
    let prefix = normalize_prefix(Path::new(prefix.trim()));
    let commands = [
        format!("config loglevel {log_level}"),
        format!("config flags {flags}"),
        format!("config prefix {prefix}"),
        "start scan".to_string(),
    ];
    for line in commands {
        writeln!(writer, "{line}").map_err(|e| format!("Patcher'a komut gönderilemedi: {e}"))?;
    }
    writer
        .flush()
        .map_err(|e| format!("Patcher'a komut gönderilemedi: {e}"))?;

    set_state("starting", "Patcher başlatıldı, oyun aranıyor...");
    {
        let mut guard = session()
            .lock()
            .map_err(|_| "Patcher durumu kaydedilemedi.".to_string())?;
        *guard = Some(Session { child, stdin: writer });
    }

    Ok(status())
}

pub fn stop() -> Result<(), String> {
    let taken = {
        let mut guard = session()
            .lock()
            .map_err(|_| "Patcher durumu okunamadı.".to_string())?;
        guard.take()
    };
    let Some(mut active) = taken else {
        set_state("idle", "Patcher çalışmıyor.");
        return Ok(());
    };

    std::thread::spawn(move || {
        let _ = writeln!(active.stdin, "stop");
        let _ = active.stdin.flush();
        for _ in 0..30 {
            match active.child.try_wait() {
                Ok(Some(_)) => break,
                Ok(None) => std::thread::sleep(std::time::Duration::from_millis(100)),
                Err(_) => break,
            }
        }
        let _ = active.child.kill();
        let _ = active.child.wait();
    });

    set_state("stopping", "Patcher durduruluyor...");
    Ok(())
}

pub fn logs() -> Vec<String> {
    match runtime().lock() {
        Ok(rt) => rt.logs.clone(),
        Err(_) => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_ok_event() {
        let event = parse_event("ok 12.3456789 config prefix set").unwrap();
        assert_eq!(event.kind, "ok");
        assert_eq!(event.timestamp, "12.3456789");
        assert_eq!(event.message, "config prefix set");
    }

    #[test]
    fn parses_status_event() {
        let event = parse_event("status 0.0012345 injecting scanning for game").unwrap();
        assert_eq!(event.kind, "status");
        assert_eq!(event.state.as_deref(), Some("injecting"));
        assert_eq!(event.message, "scanning for game");
    }

    #[test]
    fn parses_error_event() {
        let event = parse_event("error 5.0000000 unknown command").unwrap();
        assert_eq!(event.kind, "error");
        assert_eq!(event.message, "unknown command");
    }

    #[test]
    fn parses_dll_event() {
        let event = parse_event("dll 10.1234567 1234 5678 info redirected wad: A.wad.client").unwrap();
        assert_eq!(event.kind, "dll");
        assert_eq!(event.level.as_deref(), Some("info"));
        assert!(event.message.contains("pid 1234"));
        assert!(event.message.contains("redirected wad"));
    }

    #[test]
    fn ignores_blank_and_unknown_lines() {
        assert!(parse_event("").is_none());
        assert!(parse_event("   ").is_none());
        assert!(parse_event("foobar 1.0 something").is_none());
    }

    #[test]
    fn prefix_keeps_trailing_separator() {
        let prefix = normalize_prefix(Path::new("C:\\Riot Games\\overlay"));
        assert_eq!(prefix, "C:\\Riot Games\\overlay\\");
    }
}
