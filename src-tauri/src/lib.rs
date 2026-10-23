#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::Manager;

mod voidmods;
mod voidpatcher;

static HTTP: OnceLock<reqwest::Client> = OnceLock::new();
static LCU_HTTP: OnceLock<reqwest::Client> = OnceLock::new();

const MAX_ARCHIVE_ENTRIES: usize = 20_000;
const MAX_EXTRACTED_BYTES: u64 = 512 * 1024 * 1024;

fn http() -> &'static reqwest::Client {
    HTTP.get_or_init(|| {
        reqwest::Client::builder()
            .user_agent("VOID-Skin-Manager/1.0 (+league-skin-manager)")
            .timeout(Duration::from_secs(90))
            .connect_timeout(Duration::from_secs(20))
            .pool_max_idle_per_host(16)
            .build()
            .expect("http client")
    })
}

fn lcu_http() -> &'static reqwest::Client {
    LCU_HTTP.get_or_init(|| {
        reqwest::Client::builder()
            .danger_accept_invalid_certs(true)
            .user_agent("VOID-Skin-Manager/1.0")
            .timeout(Duration::from_secs(60))
            .connect_timeout(Duration::from_secs(10))
            .build()
            .expect("lcu http client")
    })
}

fn command(program: impl AsRef<std::ffi::OsStr>) -> std::process::Command {
    let mut cmd = std::process::Command::new(program);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

#[derive(Clone)]
struct LcuInfo {
    port: u16,
    password: String,
    protocol: String,
}

fn scan_lockfile() -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Some((_, path)) = detect_from_metadata("league_of_legends") {
        candidates.push(PathBuf::from(path).join("lockfile"));
    }
    for dir in common_league_dirs() {
        candidates.push(dir.join("lockfile"));
    }
    if let Some(local) = std::env::var_os("LOCALAPPDATA") {
        let base = PathBuf::from(local);
        candidates.push(
            base.join("Riot Games")
                .join("League of Legends")
                .join("lockfile"),
        );
        candidates.push(base.join("Riot Games").join("Riot Client").join("lockfile"));
    }
    candidates.into_iter().find(|p| p.exists())
}

fn resolve_lockfile_path() -> Option<PathBuf> {
    static CACHE: OnceLock<std::sync::Mutex<Option<PathBuf>>> = OnceLock::new();
    let cell = CACHE.get_or_init(|| std::sync::Mutex::new(None));
    {
        let guard = cell.lock().ok()?;
        if let Some(found) = guard.as_ref() {
            if found.exists() {
                return Some(found.clone());
            }
        }
    }
    let scanned = scan_lockfile();
    if let Ok(mut guard) = cell.lock() {
        *guard = scanned.clone();
    }
    scanned
}

fn lcu_info() -> Option<LcuInfo> {
    let path = resolve_lockfile_path()?;
    let content = fs::read_to_string(&path).ok()?;
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return None;
    }
    let parts: Vec<&str> = trimmed.split(':').collect();
    if parts.len() < 5 {
        return None;
    }
    if !parts[0].starts_with("League") {
        return None;
    }
    let port = parts[2].parse::<u16>().ok()?;
    let password = parts[3].to_string();
    let protocol = parts[4].trim().to_string();
    Some(LcuInfo {
        port,
        password,
        protocol,
    })
}

fn is_lcu_url(url: &str) -> bool {
    url.starts_with("lcu://")
}

async fn lcu_request(url: &str) -> Result<reqwest::Response, String> {
    let info = lcu_info().ok_or_else(|| "League istemcisi çalışmıyor".to_string())?;
    let rel = url.trim_start_matches("lcu://").trim_start_matches('/');
    let scheme = if info.protocol.is_empty() {
        "https"
    } else {
        info.protocol.as_str()
    };
    let full = format!("{scheme}://127.0.0.1:{}/{rel}", info.port);
    lcu_http()
        .get(&full)
        .basic_auth("riot", Some(info.password))
        .send()
        .await
        .map_err(|e| format!("LCU istek hatası: {e}"))
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DetectResult {
    pub found: bool,
    pub path: Option<String>,
    pub method: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SystemStatus {
    pub league_ready: bool,
    pub riot_client_ready: bool,
    pub mod_engine_ready: bool,
    pub league_path: Option<String>,
    pub riot_client_path: Option<String>,
    pub cache_size_mb: f64,
    pub version: String,
}

fn cache_base(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join(".cache");
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    Ok(base)
}

fn safe_relative(rel: &str) -> PathBuf {
    let cleaned = rel.replace('\\', "/");
    let mut out = PathBuf::new();
    for part in cleaned.split('/') {
        if part.is_empty() || part == "." || part == ".." || part.contains(':') {
            continue;
        }
        out.push(part);
    }
    out
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn age_ms(path: &Path) -> Option<u64> {
    let meta = fs::metadata(path).ok()?;
    let modified = meta.modified().ok()?;
    let millis = modified
        .duration_since(UNIX_EPOCH)
        .ok()?
        .as_millis() as u64;
    Some(now_ms().saturating_sub(millis))
}

fn write_atomic(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut tmp = path.as_os_str().to_owned();
    tmp.push(".tmp");
    let tmp = PathBuf::from(tmp);
    fs::write(&tmp, bytes)?;
    match fs::rename(&tmp, path) {
        Ok(()) => Ok(()),
        Err(err) => {
            let _ = fs::remove_file(&tmp);
            Err(err)
        }
    }
}

fn metadata_dir() -> Option<PathBuf> {
    let program_data = std::env::var_os("ProgramData")?;
    Some(PathBuf::from(program_data).join("Riot Games").join("Metadata"))
}

fn parse_product_install(settings_file: &Path) -> Option<String> {
    let content = fs::read_to_string(settings_file).ok()?;
    for line in content.lines() {
        let trimmed = line.trim();
        for key in [
            "product_install_full_path:",
            "product_install_root:",
        ] {
            if let Some(rest) = trimmed.strip_prefix(key) {
                let value = rest.trim().trim_matches('"').trim_matches('\'').trim();
                if !value.is_empty() && value != "unknown" {
                    return Some(value.replace('/', "\\"));
                }
            }
        }
    }
    None
}

fn detect_from_metadata(prefix: &str) -> Option<(String, String)> {
    let base = metadata_dir()?;
    let entries = fs::read_dir(&base).ok()?;
    for entry in entries.flatten() {
        let dir = entry.path();
        if !dir.is_dir() {
            continue;
        }
        let dir_name = dir
            .file_name()
            .map(|n| n.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        if !dir_name.starts_with(prefix) {
            continue;
        }
        if let Ok(files) = fs::read_dir(&dir) {
            for f in files.flatten() {
                let fp = f.path();
                if fp.extension().map(|e| e == "yaml").unwrap_or(false) {
                    if let Some(install) = parse_product_install(&fp) {
                        return Some((prefix.to_string(), install));
                    }
                }
            }
        }
    }
    None
}

fn strip_prefix_ignore_case<'a>(key: &'a str, prefix: &str) -> Option<&'a str> {
    let head = key.get(..prefix.len())?;
    if head.eq_ignore_ascii_case(prefix) {
        Some(&key[prefix.len()..])
    } else {
        None
    }
}

fn hive_of(key: &str) -> Option<(winreg::RegKey, &str)> {
    if let Some(rest) = strip_prefix_ignore_case(key, "HKEY_CURRENT_USER") {
        return Some((winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER), rest));
    }
    if let Some(rest) = strip_prefix_ignore_case(key, "HKCU") {
        return Some((winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER), rest));
    }
    if let Some(rest) = strip_prefix_ignore_case(key, "HKEY_LOCAL_MACHINE") {
        return Some((winreg::RegKey::predef(winreg::enums::HKEY_LOCAL_MACHINE), rest));
    }
    if let Some(rest) = strip_prefix_ignore_case(key, "HKLM") {
        return Some((winreg::RegKey::predef(winreg::enums::HKEY_LOCAL_MACHINE), rest));
    }
    if let Some(rest) = strip_prefix_ignore_case(key, "HKEY_CLASSES_ROOT") {
        return Some((winreg::RegKey::predef(winreg::enums::HKEY_CLASSES_ROOT), rest));
    }
    if let Some(rest) = strip_prefix_ignore_case(key, "HKCR") {
        return Some((winreg::RegKey::predef(winreg::enums::HKEY_CLASSES_ROOT), rest));
    }
    if let Some(rest) = strip_prefix_ignore_case(key, "HKEY_USERS") {
        return Some((winreg::RegKey::predef(winreg::enums::HKEY_USERS), rest));
    }
    if let Some(rest) = strip_prefix_ignore_case(key, "HKU") {
        return Some((winreg::RegKey::predef(winreg::enums::HKEY_USERS), rest));
    }
    None
}

fn reg_open(key: &str) -> Option<winreg::RegKey> {
    let (root, rest) = hive_of(key)?;
    let subkey = rest.trim_start_matches(&['\\', '/'][..]);
    if subkey.is_empty() {
        return None;
    }
    root.open_subkey_with_flags(subkey, winreg::enums::KEY_READ).ok()
}

fn reg_query(key: &str, value: &str) -> Option<String> {
    reg_open(key)?.get_value::<String, _>(value).ok()
}

fn reg_default(key: &str) -> Option<String> {
    reg_open(key)?.get_value::<String, _>("").ok()
}

fn league_client_in(dir: &Path) -> bool {
    dir.join("LeagueClient.exe").exists()
}

fn riot_client_in(dir: &Path) -> bool {
    dir.join("RiotClientServices.exe").exists()
}

fn common_league_dirs() -> Vec<PathBuf> {
    let mut out = Vec::new();
    for letter in b'C'..=b'Z' {
        let drive = format!("{}:\\", letter as char);
        let root = PathBuf::from(&drive);
        if !root.exists() {
            continue;
        }
        out.push(root.join("Riot Games").join("League of Legends"));
        out.push(root.join("Riot Games").join("LoL"));
        out.push(root.join("Program Files").join("Riot Games").join("League of Legends"));
        out.push(root.join("Program Files (x86)").join("Riot Games").join("League of Legends"));
    }
    out
}

fn common_riot_client_dirs() -> Vec<PathBuf> {
    let mut out = Vec::new();
    for letter in b'C'..=b'Z' {
        let drive = format!("{}:\\", letter as char);
        let root = PathBuf::from(&drive);
        if !root.exists() {
            continue;
        }
        out.push(root.join("Riot Games").join("Riot Client"));
        out.push(root.join("Program Files").join("Riot Games").join("Riot Client"));
    }
    out
}

fn detect_league() -> DetectResult {
    if let Some((_, path)) = detect_from_metadata("league_of_legends") {
        let pb = PathBuf::from(&path);
        if league_client_in(&pb) {
            return DetectResult {
                found: true,
                path: Some(path),
                method: Some("riot-metadata".into()),
            };
        }
    }

    for (key, value) in [
        ("HKEY_CURRENT_USER\\Software\\Riot Games\\League of Legends", "Path"),
        ("HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Riot Games\\League of Legends", "Path"),
        ("HKEY_LOCAL_MACHINE\\SOFTWARE\\Riot Games\\League of Legends", "Path"),
    ] {
        if let Some(path) = reg_query(key, value) {
            let pb = PathBuf::from(&path);
            if league_client_in(&pb) {
                return DetectResult {
                    found: true,
                    path: Some(path),
                    method: Some("registry".into()),
                };
            }
        }
    }

    for candidate in common_league_dirs() {
        if league_client_in(&candidate) {
            return DetectResult {
                found: true,
                path: Some(candidate.to_string_lossy().to_string()),
                method: Some("scan".into()),
            };
        }
    }

    DetectResult {
        found: false,
        path: None,
        method: None,
    }
}

fn detect_riot_client() -> DetectResult {
    if let Some((_, path)) = detect_from_metadata("riot client") {
        let pb = PathBuf::from(&path);
        if riot_client_in(&pb) {
            return DetectResult {
                found: true,
                path: Some(path),
                method: Some("riot-metadata".into()),
            };
        }
    }

    for (key, value) in [
        ("HKEY_CURRENT_USER\\Software\\Riot Games\\Riot Client", "InstallLocation"),
        ("HKEY_CURRENT_USER\\Software\\Riot Games\\Riot Client", "Path"),
        ("HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Riot Games\\Riot Client", "InstallLocation"),
    ] {
        if let Some(path) = reg_query(key, value) {
            let pb = PathBuf::from(&path);
            if riot_client_in(&pb) {
                return DetectResult {
                    found: true,
                    path: Some(path),
                    method: Some("registry".into()),
                };
            }
        }
    }

    for candidate in common_riot_client_dirs() {
        if riot_client_in(&candidate) {
            return DetectResult {
                found: true,
                path: Some(candidate.to_string_lossy().to_string()),
                method: Some("scan".into()),
            };
        }
    }

    DetectResult {
        found: false,
        path: None,
        method: None,
    }
}

fn dir_size_mb(path: &Path) -> f64 {
    if !path.exists() {
        return 0.0;
    }
    let mut total: u64 = 0;
    for entry in walkdir::WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            total += entry.metadata().map(|m| m.len()).unwrap_or(0);
        }
    }
    (total as f64) / (1024.0 * 1024.0)
}

fn extract_exe_path(command: &str) -> Option<PathBuf> {
    let trimmed = command.trim();
    if let Some(rest) = trimmed.strip_prefix('"') {
        if let Some(end) = rest.find('"') {
            return Some(PathBuf::from(&rest[..end]));
        }
    }
    trimmed.split_whitespace().next().map(PathBuf::from)
}

fn ltk_exe_from_registry() -> Option<PathBuf> {
    for key in [
        "HKEY_CURRENT_USER\\Software\\Classes\\ltk\\shell\\open\\command",
        "HKEY_CLASSES_ROOT\\ltk\\shell\\open\\command",
    ] {
        if let Some(command) = reg_default(key) {
            if let Some(path) = extract_exe_path(&command) {
                if path.exists() {
                    return Some(path);
                }
            }
        }
    }
    None
}

fn ltk_manager_exe() -> Option<PathBuf> {
    if let Some(found) = ltk_exe_from_registry() {
        return Some(found);
    }
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Some(pf) = std::env::var_os("ProgramFiles") {
        candidates.push(PathBuf::from(pf).join("LTK Manager").join("ltk-manager.exe"));
    }
    if let Some(pf) = std::env::var_os("ProgramFiles(x86)") {
        candidates.push(PathBuf::from(pf).join("LTK Manager").join("ltk-manager.exe"));
    }
    if let Some(local) = std::env::var_os("LOCALAPPDATA") {
        let base = PathBuf::from(local);
        candidates.push(
            base.join("Programs")
                .join("LTK Manager")
                .join("ltk-manager.exe"),
        );
        candidates.push(base.join("LTK Manager").join("ltk-manager.exe"));
    }
    candidates.into_iter().find(|p| p.exists())
}

fn ltk_game_path() -> Option<String> {
    let appdata = std::env::var_os("APPDATA")?;
    let settings = PathBuf::from(appdata)
        .join("dev.leaguetoolkit.manager")
        .join("settings.json");
    let content = fs::read_to_string(settings).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
    json.get("leaguePath")
        .and_then(|v| v.as_str())
        .map(|s| s.replace('/', "\\"))
}

fn pct_encode(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char)
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

const LTK_PATCHER_HOST_EXE: &str = "ltk_patcher_host.exe";

fn process_running(image_name: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        let filter = format!("IMAGENAME eq {image_name}");
        let output = command("tasklist")
            .args(["/FI", &filter, "/NH", "/FO", "CSV"])
            .output();
        if let Ok(out) = output {
            let text = String::from_utf8_lossy(&out.stdout).to_ascii_lowercase();
            return text.contains(&image_name.to_ascii_lowercase());
        }
    }
    false
}

fn detect_ltk() -> LtkStatus {
    let game_path = ltk_game_path().or_else(|| detect_league().path);
    let patcher_running = process_running(LTK_PATCHER_HOST_EXE);
    match ltk_manager_exe() {
        Some(exe) => LtkStatus {
            found: true,
            install_dir: exe.parent().map(|p| p.to_string_lossy().to_string()),
            exe_path: Some(exe.to_string_lossy().to_string()),
            game_path,
            patcher_running,
        },
        None => LtkStatus {
            found: false,
            install_dir: None,
            exe_path: None,
            game_path,
            patcher_running,
        },
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LtkStatus {
    pub found: bool,
    pub install_dir: Option<String>,
    pub exe_path: Option<String>,
    pub game_path: Option<String>,
    pub patcher_running: bool,
}

#[tauri::command]
async fn ltk_manager_status() -> LtkStatus {
    detect_ltk()
}

#[tauri::command]
async fn ltk_install(
    url: String,
    name: Option<String>,
    source: Option<String>,
) -> Result<(), String> {
    if !url.starts_with("https://") {
        return Err("LTK yalnızca https:// adreslerini kabul eder".into());
    }
    let mut params = format!("url={}", pct_encode(&url));
    if let Some(mod_name) = name {
        let trimmed: String = mod_name.chars().take(256).collect();
        if !trimmed.is_empty() {
            params.push_str(&format!("&name={}", pct_encode(&trimmed)));
        }
    }
    let src: String = source
        .unwrap_or_else(|| "VOID".into())
        .chars()
        .take(256)
        .collect();
    if !src.is_empty() {
        params.push_str(&format!("&source={}", pct_encode(&src)));
    }
    let deep_link = format!("ltk://install?{params}");
    let exe = ltk_manager_exe().ok_or_else(|| {
        "LTK Manager kurulu değil. LTK Manager'ı yükledikten sonra tekrar deneyin.".to_string()
    })?;
    command(exe)
        .arg(&deep_link)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("LTK Manager başlatılamadı: {e}"))
}

#[tauri::command]
async fn ltk_open() -> Result<(), String> {
    let exe = ltk_manager_exe().ok_or_else(|| "LTK Manager bulunamadı".to_string())?;
    command(exe)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ltk_import_file(path: String) -> Result<(), String> {
    let pkg = PathBuf::from(&path);
    if !pkg.exists() {
        return Err("paket dosyası bulunamadı".into());
    }
    let exe = ltk_manager_exe().ok_or_else(|| "LTK Manager bulunamadı".to_string())?;
    command(exe)
        .arg(pkg)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

fn ltk_data_dir() -> Option<PathBuf> {
    let appdata = std::env::var_os("APPDATA")?;
    Some(PathBuf::from(appdata).join("dev.leaguetoolkit.manager"))
}

fn ltk_settings_path() -> Option<PathBuf> {
    Some(ltk_data_dir()?.join("settings.json"))
}

fn title_case_slug(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    let mut boundary = true;
    for ch in value.chars() {
        if ch == '-' || ch == '_' {
            out.push(' ');
            boundary = true;
            continue;
        }
        if boundary {
            out.extend(ch.to_uppercase());
            boundary = false;
        } else {
            out.push(ch);
        }
    }
    out.trim().to_string()
}

fn read_mod_config(dir: &Path) -> Option<serde_json::Value> {
    let raw = fs::read_to_string(dir.join("mod.config.json")).ok()?;
    serde_json::from_str(&raw).ok()
}

fn json_str_array(value: Option<&serde_json::Value>) -> Vec<String> {
    value
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|item| item.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default()
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LtkMod {
    pub id: String,
    pub name: String,
    pub version: Option<String>,
    pub authors: Vec<String>,
    pub description: Option<String>,
    pub champions: Vec<String>,
    pub format: Option<String>,
    pub enabled: bool,
    pub installed_at: Option<String>,
    pub folder: Option<String>,
    pub path: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LtkLibrary {
    pub mods: Vec<LtkMod>,
    pub active_profile: Option<String>,
    pub profiles: Vec<String>,
    pub dir: Option<String>,
}

#[tauri::command]
async fn ltk_library() -> Result<LtkLibrary, String> {
    let base = ltk_data_dir().ok_or_else(|| "APPDATA bulunamadı".to_string())?;
    let raw = fs::read_to_string(base.join("library.json")).map_err(|_| {
        "LTK kütüphanesi okunamadı. LTK Manager'ı bir kez çalıştırıp tekrar deneyin.".to_string()
    })?;
    let json: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| format!("kütüphane çözümlenemedi: {e}"))?;
    let mut library = build_library(&json, &base.join("mods"));
    library.dir = Some(base.to_string_lossy().to_string());
    Ok(library)
}

fn build_library(json: &serde_json::Value, mods_dir: &Path) -> LtkLibrary {
    let active_profile_id = json
        .get("activeProfileId")
        .and_then(|v| v.as_str())
        .map(String::from);

    let mut enabled: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut profiles: Vec<String> = Vec::new();
    let mut active_profile: Option<String> = None;
    if let Some(list) = json.get("profiles").and_then(|v| v.as_array()) {
        for profile in list {
            let id = profile.get("id").and_then(|v| v.as_str()).unwrap_or_default();
            let name = profile.get("name").and_then(|v| v.as_str()).unwrap_or("");
            if !name.is_empty() {
                profiles.push(name.to_string());
            }
            if Some(id) == active_profile_id.as_deref() {
                active_profile = Some(name.to_string());
                for mod_id in json_str_array(profile.get("enabledMods")) {
                    enabled.insert(mod_id);
                }
            }
        }
    }
    if active_profile.is_none() {
        active_profile = profiles.first().cloned();
    }

    let mut folder_of: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();
    if let Some(list) = json.get("folders").and_then(|v| v.as_array()) {
        for folder in list {
            let name = folder.get("name").and_then(|v| v.as_str()).unwrap_or("");
            if name.is_empty() {
                continue;
            }
            for mod_id in json_str_array(folder.get("modIds")) {
                folder_of.insert(mod_id, name.to_string());
            }
        }
    }

    let mut mods: Vec<LtkMod> = Vec::new();
    if let Some(list) = json.get("mods").and_then(|v| v.as_array()) {
        for entry in list {
            let id = entry.get("id").and_then(|v| v.as_str()).unwrap_or_default();
            if id.is_empty() {
                continue;
            }
            let slug = entry.get("slug").and_then(|v| v.as_str());
            let config = read_mod_config(&mods_dir.join(slug.unwrap_or(id)))
                .or_else(|| read_mod_config(&mods_dir.join(id)));
            let path = {
                let candidate = mods_dir.join(slug.unwrap_or(id));
                let fallback = mods_dir.join(id);
                if candidate.exists() {
                    Some(candidate.to_string_lossy().to_string())
                } else if fallback.exists() {
                    Some(fallback.to_string_lossy().to_string())
                } else {
                    None
                }
            };

            let display = config
                .as_ref()
                .and_then(|c| c.get("display_name").and_then(|v| v.as_str()))
                .filter(|s| !s.is_empty())
                .map(String::from)
                .or_else(|| slug.map(title_case_slug))
                .unwrap_or_else(|| id.to_string());

            let version = config
                .as_ref()
                .and_then(|c| c.get("version").and_then(|v| v.as_str()))
                .map(String::from);
            let description = config
                .as_ref()
                .and_then(|c| c.get("description").and_then(|v| v.as_str()))
                .filter(|s| !s.is_empty())
                .map(String::from);

            mods.push(LtkMod {
                id: id.to_string(),
                name: display,
                version,
                authors: json_str_array(config.as_ref().and_then(|c| c.get("authors"))),
                description,
                champions: json_str_array(config.as_ref().and_then(|c| c.get("champions"))),
                format: entry
                    .get("format")
                    .and_then(|v| v.as_str())
                    .map(String::from),
                enabled: enabled.contains(id),
                installed_at: entry
                    .get("installedAt")
                    .and_then(|v| v.as_str())
                    .map(String::from),
                folder: folder_of.get(id).cloned(),
                path,
            });
        }
    }

    mods.sort_by(|a, b| {
        b.enabled
            .cmp(&a.enabled)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    LtkLibrary {
        mods,
        active_profile,
        profiles,
        dir: None,
    }
}

fn set_mod_enabled_in_json(
    json: &mut serde_json::Value,
    mod_id: &str,
    enabled: bool,
) -> Result<(), String> {
    let exists = json
        .get("mods")
        .and_then(|v| v.as_array())
        .map(|list| {
            list.iter()
                .any(|m| m.get("id").and_then(|v| v.as_str()) == Some(mod_id))
        })
        .unwrap_or(false);
    if !exists {
        return Err("mod kütüphanede bulunamadı".into());
    }

    let active_id = json
        .get("activeProfileId")
        .and_then(|v| v.as_str())
        .map(String::from);
    let profiles = json
        .get_mut("profiles")
        .and_then(|v| v.as_array_mut())
        .ok_or_else(|| "kütüphanede profil listesi yok".to_string())?;
    let index = match active_id {
        Some(ref id) => profiles
            .iter()
            .position(|p| p.get("id").and_then(|v| v.as_str()) == Some(id.as_str())),
        None => None,
    }
    .or_else(|| if profiles.is_empty() { None } else { Some(0) })
    .ok_or_else(|| "etkin profil bulunamadı".to_string())?;
    let profile = &mut profiles[index];

    let object = profile
        .as_object_mut()
        .ok_or_else(|| "profil biçimi geçersiz".to_string())?;
    let entry = object
        .entry("enabledMods")
        .or_insert_with(|| serde_json::Value::Array(Vec::new()));
    let list = entry
        .as_array_mut()
        .ok_or_else(|| "enabledMods biçimi geçersiz".to_string())?;
    let position = list
        .iter()
        .position(|v| v.as_str() == Some(mod_id));
    match (enabled, position) {
        (true, None) => list.push(serde_json::Value::String(mod_id.to_string())),
        (false, Some(index)) => {
            list.remove(index);
        }
        _ => {}
    }
    Ok(())
}

#[tauri::command]
async fn ltk_set_mod_enabled(mod_id: String, enabled: bool) -> Result<LtkLibrary, String> {
    let base = ltk_data_dir().ok_or_else(|| "APPDATA bulunamadı".to_string())?;
    let path = base.join("library.json");
    let raw = fs::read_to_string(&path).map_err(|_| {
        "LTK kütüphanesi okunamadı. LTK Manager'ı bir kez çalıştırıp tekrar deneyin.".to_string()
    })?;
    let mut json: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| format!("kütüphane çözümlenemedi: {e}"))?;

    set_mod_enabled_in_json(&mut json, &mod_id, enabled)?;

    let bytes = serde_json::to_vec_pretty(&json).map_err(|e| e.to_string())?;
    let backup = base.join("library.json.void-backup");
    fs::copy(&path, &backup).map_err(|e| format!("yedek oluşturulamadı: {e}"))?;
    write_atomic(&path, &bytes).map_err(|e| format!("kütüphane yazılamadı: {e}"))?;

    let mut library = build_library(&json, &base.join("mods"));
    library.dir = Some(base.to_string_lossy().to_string());
    Ok(library)
}

#[tauri::command]
async fn ltk_set_mods_bulk(
    mod_ids: Vec<String>,
    enabled: bool,
) -> Result<LtkLibrary, String> {
    if mod_ids.is_empty() {
        return Err("hiçbir mod seçilmedi".into());
    }
    if mod_ids.len() > 500 {
        return Err("çok fazla mod seçildi".into());
    }
    let base = ltk_data_dir().ok_or_else(|| "APPDATA bulunamadı".to_string())?;
    let path = base.join("library.json");
    let raw = fs::read_to_string(&path).map_err(|_| {
        "LTK kütüphanesi okunamadı. LTK Manager'ı bir kez çalıştırıp tekrar deneyin.".to_string()
    })?;
    let mut json: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| format!("kütüphane çözümlenemedi: {e}"))?;

    let mut changed = 0usize;
    let mut failed: Vec<String> = Vec::new();
    for mod_id in &mod_ids {
        match set_mod_enabled_in_json(&mut json, mod_id, enabled) {
            Ok(()) => changed += 1,
            Err(_) => failed.push(mod_id.clone()),
        }
    }
    if changed == 0 {
        return Err("seçilen modların hiçbiri güncellenemedi".into());
    }

    let bytes = serde_json::to_vec_pretty(&json).map_err(|e| e.to_string())?;
    let backup = base.join("library.json.void-backup");
    let _ = fs::copy(&path, &backup);
    write_atomic(&path, &bytes).map_err(|e| format!("kütüphane yazılamadı: {e}"))?;

    let mut library = build_library(&json, &base.join("mods"));
    library.dir = Some(base.to_string_lossy().to_string());
    Ok(library)
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LibraryBackup {
    pub path: String,
    pub name: String,
    pub size_kb: u64,
    pub created_at: u64,
}

fn collect_backups(dir: &Path) -> Vec<LibraryBackup> {
    let mut out: Vec<LibraryBackup> = Vec::new();
    let Ok(entries) = fs::read_dir(dir) else {
        return out;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if !name.starts_with("library") {
            continue;
        }
        if !name.ends_with(".json") && !name.ends_with(".void-backup") {
            continue;
        }
        let Ok(meta) = entry.metadata() else { continue };
        let created_at = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        out.push(LibraryBackup {
            path: path.to_string_lossy().to_string(),
            name: name.to_string(),
            size_kb: meta.len() / 1024,
            created_at,
        });
    }
    out.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    out
}

#[tauri::command]
async fn ltk_list_backups() -> Result<Vec<LibraryBackup>, String> {
    let base = ltk_data_dir().ok_or_else(|| "APPDATA bulunamadı".to_string())?;
    Ok(collect_backups(&base))
}

#[tauri::command]
async fn ltk_backup_library(destination: String) -> Result<String, String> {
    if destination.trim().is_empty() {
        return Err("hedef yol boş olamaz".into());
    }
    let base = ltk_data_dir().ok_or_else(|| "APPDATA bulunamadı".to_string())?;
    let source = base.join("library.json");
    if !source.is_file() {
        return Err("LTK kütüphanesi bulunamadı".into());
    }
    let target = PathBuf::from(&destination);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("hedef klasör oluşturulamadı: {e}"))?;
    }
    fs::copy(&source, &target).map_err(|e| format!("yedek kopyalanamadı: {e}"))?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
async fn ltk_restore_library(source: String) -> Result<LtkLibrary, String> {
    if source.trim().is_empty() {
        return Err("kaynak yol boş olamaz".into());
    }
    let base = ltk_data_dir().ok_or_else(|| "APPDATA bulunamadı".to_string())?;
    let raw = fs::read_to_string(&source).map_err(|e| format!("yedek okunamadı: {e}"))?;
    let json: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| format!("yedek geçersiz: {e}"))?;
    if json.get("mods").and_then(|v| v.as_array()).is_none() {
        return Err("yedek dosyası LTK kütüphane biçiminde değil".into());
    }
    let bytes = serde_json::to_vec_pretty(&json).map_err(|e| e.to_string())?;
    let target = base.join("library.json");
    let safety = base.join("library.json.void-backup");
    let _ = fs::copy(&target, &safety);
    write_atomic(&target, &bytes).map_err(|e| format!("kütüphane yazılamadı: {e}"))?;
    let mut library = build_library(&json, &base.join("mods"));
    library.dir = Some(base.to_string_lossy().to_string());
    Ok(library)
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DirEntryInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size_kb: u64,
}

#[tauri::command]
async fn list_dir_entries(path: String) -> Result<Vec<DirEntryInfo>, String> {
    let base = PathBuf::from(&path);
    if !base.is_dir() {
        return Err("klasör bulunamadı".into());
    }
    let entries = fs::read_dir(&base).map_err(|e| format!("klasör okunamadı: {e}"))?;
    let mut out: Vec<DirEntryInfo> = Vec::new();
    for entry in entries.flatten() {
        let Ok(meta) = entry.metadata() else { continue };
        let name = entry.file_name().to_string_lossy().to_string();
        out.push(DirEntryInfo {
            path: entry.path().to_string_lossy().to_string(),
            is_dir: meta.is_dir(),
            size_kb: if meta.is_dir() { 0 } else { meta.len() / 1024 },
            name,
        });
    }
    out.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(out)
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub version: String,
    pub name: String,
    pub tauri_version: String,
    pub os: String,
    pub arch: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModHealthIssue {
    pub mod_id: String,
    pub mod_name: String,
    pub severity: String,
    pub code: String,
    pub message: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModHealthReport {
    pub issues: Vec<ModHealthIssue>,
    pub checked: usize,
    pub healthy: usize,
}

fn mod_health_issues(
    json: &serde_json::Value,
    mods_dir: &Path,
) -> Vec<ModHealthIssue> {
    let mut issues: Vec<ModHealthIssue> = Vec::new();
    let Some(list) = json.get("mods").and_then(|v| v.as_array()) else {
        return issues;
    };
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();

    for entry in list {
        let id = entry
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        if id.is_empty() {
            continue;
        }
        let slug = entry.get("slug").and_then(|v| v.as_str()).unwrap_or(&id);
        let display = entry
            .get("name")
            .and_then(|v| v.as_str())
            .map(String::from)
            .unwrap_or_else(|| title_case_slug(slug));
        let path = mods_dir.join(slug);
        let fallback = mods_dir.join(&id);

        if !seen.insert(id.clone()) {
            issues.push(ModHealthIssue {
                mod_id: id.clone(),
                mod_name: display.clone(),
                severity: "error".into(),
                code: "duplicate_id".into(),
                message: "Kütüphanede birden fazla kayıt aynı kimliği kullanıyor.".into(),
            });
            continue;
        }

        if !path.exists() && !fallback.exists() {
            issues.push(ModHealthIssue {
                mod_id: id.clone(),
                mod_name: display.clone(),
                severity: "error".into(),
                code: "missing_folder".into(),
                message: "Mod klasörü diskte bulunamadı.".into(),
            });
            continue;
        }

        let mod_dir = if path.exists() { &path } else { &fallback };
        if read_mod_config(mod_dir).is_none() {
            issues.push(ModHealthIssue {
                mod_id: id.clone(),
                mod_name: display.clone(),
                severity: "warning".into(),
                code: "missing_config".into(),
                message: "mod.config.json okunamadı, küçük resim yüklenemeyebilir.".into(),
            });
        }

        if entry.get("format").and_then(|v| v.as_str()).is_none() {
            issues.push(ModHealthIssue {
                mod_id: id.clone(),
                mod_name: display.clone(),
                severity: "info".into(),
                code: "missing_format".into(),
                message: "Paket biçimi kayıtlı değil.".into(),
            });
        }

        let total = fs::read_dir(mod_dir)
            .map(|entries| entries.flatten().count())
            .unwrap_or(0);
        if total == 0 {
            issues.push(ModHealthIssue {
                mod_id: id.clone(),
                mod_name: display.clone(),
                severity: "warning".into(),
                code: "empty_folder".into(),
                message: "Mod klasörü boş.".into(),
            });
        }
    }

    issues
}

#[tauri::command]
async fn ltk_mod_health() -> Result<ModHealthReport, String> {
    let base = ltk_data_dir().ok_or_else(|| "APPDATA bulunamadı".to_string())?;
    let raw = fs::read_to_string(base.join("library.json")).map_err(|_| {
        "LTK kütüphanesi okunamadı. LTK Manager'ı bir kez çalıştırıp tekrar deneyin.".to_string()
    })?;
    let json: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| format!("kütüphane çözümlenemedi: {e}"))?;
    let issues = mod_health_issues(&json, &base.join("mods"));
    let broken = issues
        .iter()
        .filter(|i| i.severity == "error")
        .map(|i| i.mod_id.as_str())
        .collect::<std::collections::HashSet<_>>();
    let checked = json
        .get("mods")
        .and_then(|v| v.as_array())
        .map(|a| a.len())
        .unwrap_or(0);
    let healthy = checked.saturating_sub(broken.len());
    Ok(ModHealthReport {
        issues,
        checked,
        healthy,
    })
}

#[tauri::command]
async fn app_info() -> AppInfo {
    AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        name: env!("CARGO_PKG_NAME").to_string(),
        tauri_version: tauri::VERSION.to_string(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
    }
}

fn autostart_registered() -> bool {
    reg_query(
        "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
        "VOID-LTK-Patcher",
    )
    .is_some()
}

fn patcher_config() -> LtkPatcherConfig {
    let json = ltk_settings_path()
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok());
    let flag = |key: &str| {
        json.as_ref()
            .and_then(|j| j.get(key))
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
    };
    LtkPatcherConfig {
        installed: ltk_manager_exe().is_some(),
        always_start_patcher: flag("alwaysStartPatcher"),
        start_in_tray: flag("startInTray"),
        auto_run: flag("autoRun"),
        autostart_registered: autostart_registered(),
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LtkPatcherConfig {
    pub installed: bool,
    pub always_start_patcher: bool,
    pub start_in_tray: bool,
    pub auto_run: bool,
    pub autostart_registered: bool,
}

#[tauri::command]
async fn ltk_patcher_config() -> LtkPatcherConfig {
    patcher_config()
}

#[tauri::command]
async fn ltk_set_autostart(enabled: bool) -> Result<LtkPatcherConfig, String> {
    let run_key = "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    if enabled {
        let exe = ltk_manager_exe()
            .ok_or_else(|| "LTK Manager kurulu değil, otomatik başlatma kurulamaz.".to_string())?;
        let output = command("reg")
            .args([
                "add",
                run_key,
                "/v",
                "VOID-LTK-Patcher",
                "/t",
                "REG_SZ",
                "/d",
                &format!("\"{}\"", exe.to_string_lossy()),
                "/f",
            ])
            .output()
            .map_err(|e| format!("kayıt defteri güncellenemedi: {e}"))?;
        if !output.status.success() {
            return Err("otomatik başlatma kaydedilemedi".into());
        }
    } else if reg_query(run_key, "VOID-LTK-Patcher").is_some() {
        let output = command("reg")
            .args(["delete", run_key, "/v", "VOID-LTK-Patcher", "/f"])
            .output()
            .map_err(|e| format!("kayıt defteri güncellenemedi: {e}"))?;
        if !output.status.success() {
            return Err("otomatik başlatma kaldırılamadı".into());
        }
    }
    Ok(patcher_config())
}

#[tauri::command]
async fn ltk_set_patcher_flags(enabled: bool) -> Result<LtkPatcherConfig, String> {
    let path = ltk_settings_path()
        .ok_or_else(|| "LTK ayar dosyası bulunamadı".to_string())?;
    let raw = fs::read_to_string(&path)
        .map_err(|_| "LTK ayarları okunamadı. LTK Manager'ı bir kez çalıştırın.".to_string())?;
    let mut json: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| format!("ayarlar çözümlenemedi: {e}"))?;
    if let Some(obj) = json.as_object_mut() {
        obj.insert("alwaysStartPatcher".into(), serde_json::Value::Bool(enabled));
        obj.insert("startInTray".into(), serde_json::Value::Bool(enabled));
    }
    let text = serde_json::to_string_pretty(&json).map_err(|e| e.to_string())?;
    write_atomic(&path, text.as_bytes()).map_err(|e| format!("ayarlar yazılamadı: {e}"))?;
    Ok(patcher_config())
}

#[tauri::command]
async fn ltk_launch() -> Result<(), String> {
    let exe = ltk_manager_exe()
        .ok_or_else(|| "LTK Manager kurulu değil. Önce LTK Manager'ı yükleyin.".to_string())?;
    command(exe)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("LTK Manager başlatılamadı: {e}"))
}

#[tauri::command]
async fn detect_league_path() -> DetectResult {
    detect_league()
}

#[tauri::command]
async fn detect_riot_client_path() -> DetectResult {
    detect_riot_client()
}

#[tauri::command]
async fn get_system_status(app: tauri::AppHandle) -> SystemStatus {
    let league = detect_league();
    let riot = detect_riot_client();
    let cache_size_mb = cache_base(&app)
        .map(|b| dir_size_mb(&b))
        .unwrap_or(0.0);
    let mod_engine_ready = voidmods::resolve_game_dir().is_some();
    SystemStatus {
        league_ready: league.found,
        riot_client_ready: riot.found,
        mod_engine_ready,
        league_path: league.path,
        riot_client_path: riot.path,
        cache_size_mb,
        version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LcuStatus {
    running: bool,
    port: Option<u16>,
}

#[tauri::command]
async fn lcu_status() -> LcuStatus {
    match lcu_info() {
        Some(info) => LcuStatus {
            running: true,
            port: Some(info.port),
        },
        None => LcuStatus {
            running: false,
            port: None,
        },
    }
}

#[tauri::command]
async fn fetch_text(url: String) -> Result<String, String> {
    if is_lcu_url(&url) {
        let resp = lcu_request(&url).await?;
        if !resp.status().is_success() {
            return Err(format!("LCU HTTP {}", resp.status().as_u16()));
        }
        return resp.text().await.map_err(|e| e.to_string());
    }
    let resp = http()
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("istek hatası: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status().as_u16()));
    }
    resp.text().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn fetch_text_cached(
    url: String,
    cache_key: String,
    ttl_ms: u64,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let base = cache_base(&app)?;
    let rel = safe_relative(&cache_key);
    let full = base.join(&rel);
    if full.starts_with(&base) && full.exists() {
        if let Ok(meta) = fs::metadata(&full) {
            let age = now_ms().saturating_sub(
                meta.modified()
                    .ok()
                    .and_then(|m| m.duration_since(UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0),
            );
            if ttl_ms == 0 || age < ttl_ms {
                if let Ok(text) = fs::read_to_string(&full) {
                    if !text.is_empty() {
                        return Ok(text);
                    }
                }
            }
        }
    }
    let text = fetch_text(url).await?;
    if !full.starts_with(&base) {
        return Err("geçersiz yol".into());
    }
    let _ = write_atomic(&full, text.as_bytes());
    Ok(text)
}

#[tauri::command]
async fn download_to_cache(
    url: String,
    cache_key: String,
    ttl_ms: u64,
    reuse: bool,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let base = cache_base(&app)?;
    let rel = safe_relative(&cache_key);
    let full = base.join(&rel);
    if !full.starts_with(&base) {
        return Err("geçersiz yol".into());
    }
    if reuse && full.exists() {
        let stale = age_ms(&full).is_some_and(|age| ttl_ms != 0 && age >= ttl_ms);
        if !stale {
            if let Ok(meta) = fs::metadata(&full) {
                if meta.len() > 0 {
                    return Ok(full.to_string_lossy().to_string());
                }
            }
        }
    }
    let bytes = if is_lcu_url(&url) {
        let resp = lcu_request(&url).await?;
        if !resp.status().is_success() {
            return Err(format!("LCU HTTP {}", resp.status().as_u16()));
        }
        resp.bytes().await.map_err(|e| e.to_string())?
    } else {
        let resp = http()
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("indirme hatası: {e}"))?;
        if !resp.status().is_success() {
            return Err(format!("HTTP {}", resp.status().as_u16()));
        }
        resp.bytes().await.map_err(|e| e.to_string())?
    };
    write_atomic(&full, &bytes).map_err(|e| format!("önbelleğe yazılamadı: {e}"))?;
    Ok(full.to_string_lossy().to_string())
}

#[tauri::command]
async fn cache_resolve(
    cache_key: String,
    ttl_ms: u64,
    app: tauri::AppHandle,
) -> Option<String> {
    let base = cache_base(&app).ok()?;
    let full = base.join(safe_relative(&cache_key));
    if !full.starts_with(&base) || !full.exists() {
        return None;
    }
    if age_ms(&full).is_some_and(|age| ttl_ms != 0 && age >= ttl_ms) {
        return None;
    }
    Some(full.to_string_lossy().to_string())
}

#[tauri::command]
async fn clear_image_cache(app: tauri::AppHandle) -> Result<f64, String> {
    let base = cache_base(&app)?;
    let images = base.join("images");
    let freed = dir_size_mb(&images);
    if images.exists() {
        fs::remove_dir_all(&images).map_err(|e| e.to_string())?;
    }
    Ok(freed)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CacheStats {
    files: u64,
    mb: f64,
}

fn cache_dir_stats(path: &Path) -> CacheStats {
    if !path.exists() {
        return CacheStats {
            files: 0,
            mb: 0.0,
        };
    }
    let mut files: u64 = 0;
    let mut total: u64 = 0;
    for entry in walkdir::WalkDir::new(path)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            files += 1;
            total += entry.metadata().map(|m| m.len()).unwrap_or(0);
        }
    }
    CacheStats {
        files,
        mb: (total as f64) / (1024.0 * 1024.0),
    }
}

#[tauri::command]
async fn image_cache_stats(app: tauri::AppHandle) -> Result<CacheStats, String> {
    let base = cache_base(&app)?;
    Ok(cache_dir_stats(&base.join("images")))
}

const MAX_TEXT_FILE_BYTES: u64 = 64 * 1024 * 1024;

#[tauri::command]
async fn save_text_file(path: String, content: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("dosya yolu boş olamaz".into());
    }
    if content.len() as u64 > MAX_TEXT_FILE_BYTES {
        return Err("dosya çok büyük".into());
    }
    write_atomic(&PathBuf::from(&path), content.as_bytes())
        .map_err(|e| format!("dosya yazılamadı: {e}"))
}

#[tauri::command]
async fn load_text_file(path: String) -> Result<String, String> {
    if path.trim().is_empty() {
        return Err("dosya yolu boş olamaz".into());
    }
    let target = PathBuf::from(&path);
    let meta = fs::metadata(&target).map_err(|_| "dosya okunamadı".to_string())?;
    if meta.len() > MAX_TEXT_FILE_BYTES {
        return Err("dosya çok büyük".into());
    }
    fs::read_to_string(&target).map_err(|e| format!("dosya okunamadı: {e}"))
}

#[tauri::command]
async fn copy_file(source: String, destination: String) -> Result<(), String> {
    if destination.trim().is_empty() {
        return Err("hedef yol boş olamaz".into());
    }
    let src = PathBuf::from(&source);
    if !src.is_file() {
        return Err("kaynak dosya bulunamadı".into());
    }
    let dst = PathBuf::from(&destination);
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("hedef klasör oluşturulamadı: {e}"))?;
    }
    fs::copy(&src, &dst).map_err(|e| format!("dosya kopyalanamadı: {e}"))?;
    Ok(())
}

#[tauri::command]
async fn open_folder(path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    #[cfg(target_os = "windows")]
    {
        command("explorer")
            .arg(target)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn open_url(url: String) -> Result<(), String> {
    if !url.starts_with("https://github.com/") {
        return Err("yalnızca GitHub bağlantıları açılabilir".into());
    }
    if url
        .chars()
        .any(|c| c.is_whitespace() || c == '"' || c == '\'' || c == '\\')
    {
        return Err("geçersiz bağlantı".into());
    }
    #[cfg(target_os = "windows")]
    {
        command("explorer")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
struct PatchRequest {
    champion_id: u32,
    skin_id: u32,
    package_path: String,
    archive_format: String,
    target_mode: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PatchResult {
    success: bool,
    message: String,
    backup_path: Option<String>,
}

#[tauri::command]
async fn extract_mod_package(package_path: String, dest_dir: String) -> Result<Vec<String>, String> {
    let pkg = PathBuf::from(&package_path);
    if !pkg.exists() {
        return Err("paket bulunamadı".into());
    }
    let dest = PathBuf::from(&dest_dir);
    fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
    let file = fs::File::open(&pkg).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    if archive.len() > MAX_ARCHIVE_ENTRIES {
        return Err("paket içinde çok fazla dosya var".into());
    }
    let mut written = Vec::new();
    let mut total: u64 = 0;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = match entry.enclosed_name() {
            Some(p) => dest.join(p),
            None => continue,
        };
        if entry.is_dir() {
            fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
            continue;
        }
        if let Some(parent) = outpath.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut outfile = fs::File::create(&outpath).map_err(|e| e.to_string())?;
        let copied = std::io::copy(&mut entry, &mut outfile).map_err(|e| e.to_string())?;
        total = total.saturating_add(copied);
        if total > MAX_EXTRACTED_BYTES {
            drop(outfile);
            let _ = fs::remove_file(&outpath);
            return Err("paket açılmış boyutu sınırı aşıyor".into());
        }
        written.push(outpath.to_string_lossy().to_string());
    }
    Ok(written)
}

#[tauri::command]
async fn apply_mod(req: PatchRequest) -> Result<PatchResult, String> {
    let pkg = PathBuf::from(&req.package_path);
    if !pkg.exists() {
        return Ok(PatchResult {
            success: false,
            message: "Paket dosyası bulunamadı, önce indirilmesi gerekiyor.".into(),
            backup_path: None,
        });
    }
    let league = detect_league();
    let Some(league_path) = league.path else {
        return Ok(PatchResult {
            success: false,
            message: "League of Legends kurulumu bulunamadı.".into(),
            backup_path: None,
        });
    };
    let staging = std::env::temp_dir().join(format!("void_stage_{}", req.skin_id));
    let files = extract_mod_package(
        req.package_path.clone(),
        staging.to_string_lossy().to_string(),
    )
    .await?;
    let active = PathBuf::from(&league_path).join("VOID_ACTIVE_MODS");
    fs::create_dir_all(&active).map_err(|e| e.to_string())?;
    let mut copied = 0usize;
    let mut failed = 0usize;
    for f in &files {
        if let Some(name) = PathBuf::from(f).file_name() {
            let dest = active.join(format!("{}_{}", req.skin_id, name.to_string_lossy()));
            match fs::copy(f, &dest) {
                Ok(_) => copied += 1,
                Err(_) => failed += 1,
            }
        }
    }
    let _ = fs::remove_dir_all(&staging);
    if copied == 0 {
        return Ok(PatchResult {
            success: false,
            message: format!("Hiçbir dosya kopyalanamadı ({} hata).", failed),
            backup_path: None,
        });
    }
    let message = if failed > 0 {
        format!(
            "Kostüm kısmen uygulandı ({} dosya kopyalandı, {} hata).",
            copied, failed
        )
    } else {
        format!(
            "Kostüm uygulandı ({} paketi, {} dosya)",
            req.archive_format, copied
        )
    };
    Ok(PatchResult {
        success: true,
        message,
        backup_path: Some(active.to_string_lossy().to_string()),
    })
}

#[tauri::command]
async fn revert_last_patch() -> Result<PatchResult, String> {
    let league = detect_league();
    let Some(league_path) = league.path else {
        return Ok(PatchResult {
            success: false,
            message: "League of Legends kurulumu bulunamadı.".into(),
            backup_path: None,
        });
    };
    let active = PathBuf::from(&league_path).join("VOID_ACTIVE_MODS");
    if !active.exists() {
        return Ok(PatchResult {
            success: false,
            message: "Geri alınacak patch bulunamadı.".into(),
            backup_path: None,
        });
    }
    fs::remove_dir_all(&active).map_err(|e| format!("patch klasörü silinemedi: {e}"))?;
    Ok(PatchResult {
        success: true,
        message: "Son patch geri alındı.".into(),
        backup_path: None,
    })
}

#[tauri::command]
async fn void_mods_paths() -> Result<voidmods::VoidModsPaths, String> {
    voidmods::paths()
}

#[tauri::command]
async fn void_mods_list() -> Result<Vec<voidmods::VoidMod>, String> {
    voidmods::list_mods()
}

#[tauri::command]
async fn void_mods_import(package_path: String) -> Result<voidmods::VoidMod, String> {
    tauri::async_runtime::spawn_blocking(move || {
        voidmods::import_package(Path::new(&package_path))
    })
    .await
    .map_err(|e| format!("İçe aktarma görevi başlatılamadı: {e}"))?
}

#[tauri::command]
async fn void_mods_set_enabled(
    id: String,
    enabled: bool,
) -> Result<Vec<voidmods::VoidMod>, String> {
    voidmods::set_enabled(&id, enabled)
}

#[tauri::command]
async fn void_mods_remove(id: String) -> Result<Vec<voidmods::VoidMod>, String> {
    voidmods::remove_mod(&id)
}

#[tauri::command]
async fn void_mods_build_overlay(
    app: tauri::AppHandle,
) -> Result<voidmods::OverlaySummary, String> {
    tauri::async_runtime::spawn_blocking(move || voidmods::build_overlay(app))
        .await
        .map_err(|e| format!("Overlay derleme görevi başlatılamadı: {e}"))?
}

#[tauri::command]
async fn void_mods_import_for_skin(
    package_path: String,
    skin_id: u32,
) -> Result<voidmods::VoidMod, String> {
    tauri::async_runtime::spawn_blocking(move || {
        voidmods::import_for_skin(Path::new(&package_path), skin_id)
    })
    .await
    .map_err(|e| format!("İçe aktarma görevi başlatılamadı: {e}"))?
}

#[tauri::command]
async fn void_mods_remove_by_skin(skin_id: u32) -> Result<Vec<voidmods::VoidMod>, String> {
    voidmods::remove_by_skin(skin_id)
}

#[tauri::command]
async fn void_mods_set_enabled_many(
    ids: Vec<String>,
    enabled: bool,
) -> Result<Vec<voidmods::VoidMod>, String> {
    voidmods::set_enabled_many(&ids, enabled)
}

#[tauri::command]
async fn void_overlay_status() -> Result<voidmods::OverlayStatus, String> {
    voidmods::overlay_status()
}

#[tauri::command]
async fn void_mods_health() -> Result<Vec<voidmods::ModHealth>, String> {
    voidmods::mods_health()
}

#[tauri::command]
async fn void_diagnostics(app: tauri::AppHandle) -> Result<voidmods::Diagnostics, String> {
    let version = app.package_info().version.to_string();
    let status = voidpatcher::status();
    Ok(voidmods::diagnostics(version, status.available, status.host_path))
}

#[tauri::command]
async fn void_patcher_status() -> voidpatcher::PatcherStatus {
    voidpatcher::status()
}

#[tauri::command]
async fn void_patcher_config() -> voidpatcher::PatcherConfig {
    voidpatcher::config()
}

#[tauri::command]
async fn void_patcher_start(
    app: tauri::AppHandle,
    prefix: Option<String>,
    log_level: Option<u32>,
    flags: Option<u32>,
) -> Result<voidpatcher::PatcherStatus, String> {
    let target = match prefix {
        Some(value) if !value.trim().is_empty() => value,
        _ => voidmods::overlay_dir()?.to_string_lossy().to_string(),
    };
    let level = log_level.unwrap_or(voidpatcher::LOG_LEVEL_INFO);
    let mask = flags.unwrap_or(voidpatcher::HOOK_OPT_OUT_AH_V1);
    tauri::async_runtime::spawn_blocking(move || voidpatcher::start(app, &target, level, mask))
        .await
        .map_err(|e| format!("Patcher görevi başlatılamadı: {e}"))?
}

#[tauri::command]
async fn void_patcher_stop() -> Result<(), String> {
    voidpatcher::stop()
}

#[tauri::command]
async fn void_patcher_logs() -> Vec<String> {
    voidpatcher::logs()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            detect_league_path,
            detect_riot_client_path,
            get_system_status,
            lcu_status,
            fetch_text,
            fetch_text_cached,
            download_to_cache,
            cache_resolve,
            clear_image_cache,
            image_cache_stats,
            save_text_file,
            load_text_file,
            copy_file,
            open_folder,
            open_url,
            extract_mod_package,
            apply_mod,
            revert_last_patch,
            ltk_manager_status,
            ltk_install,
            ltk_open,
            ltk_import_file,
            ltk_library,
            ltk_set_mod_enabled,
            ltk_set_mods_bulk,
            ltk_list_backups,
            ltk_backup_library,
            ltk_restore_library,
            list_dir_entries,
            app_info,
            ltk_mod_health,
            ltk_patcher_config,
            ltk_set_autostart,
            ltk_set_patcher_flags,
            ltk_launch,
            void_mods_paths,
            void_mods_list,
            void_mods_import,
            void_mods_set_enabled,
            void_mods_remove,
            void_mods_build_overlay,
            void_mods_import_for_skin,
            void_mods_remove_by_skin,
            void_mods_set_enabled_many,
            void_overlay_status,
            void_mods_health,
            void_diagnostics,
            void_patcher_status,
            void_patcher_config,
            void_patcher_start,
            void_patcher_stop,
            void_patcher_logs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{
        build_library, cache_dir_stats, collect_backups, hive_of, list_dir_entries,
        load_text_file, mod_health_issues, now_ms, pct_encode, reg_query, save_text_file,
        set_mod_enabled_in_json, title_case_slug,
    };
    use std::path::Path;

    fn deep_link(url: &str, name: &str) -> String {
        format!(
            "ltk://install?url={}&name={}&source={}",
            pct_encode(url),
            pct_encode(name),
            pct_encode("VOID")
        )
    }

    fn query_pairs(link: &str) -> std::collections::HashMap<String, String> {
        let parsed = reqwest::Url::parse(link).expect("derin link ayrıştırılamadı");
        assert_eq!(parsed.host_str(), Some("install"));
        parsed.query_pairs().into_owned().collect()
    }

    #[test]
    fn derin_link_indirme_adresini_aynen_cozar() {
        let url =
            "https://raw.githubusercontent.com/org/repo/main/skins/1/2/PROJECT%20Ahri.fantome";
        let pairs = query_pairs(&deep_link(url, "PROJECT Ahri"));
        assert_eq!(pairs.get("url").map(String::as_str), Some(url));
        assert_eq!(pairs.get("name").map(String::as_str), Some("PROJECT Ahri"));

        let download = reqwest::Url::parse(pairs.get("url").unwrap()).expect("geçersiz adres");
        assert_eq!(download.scheme(), "https");
        assert_eq!(download.host_str(), Some("raw.githubusercontent.com"));
    }

    #[test]
    fn arti_isareti_kodlanmazsa_bosluga_donusur() {
        let url = "https://raw.githubusercontent.com/a/b/main/League+Skin.fantome";

        let mut without_encoding = String::from("ltk://install?url=");
        without_encoding.push_str(url);
        assert_eq!(
            query_pairs(&without_encoding).get("url").map(String::as_str),
            Some("https://raw.githubusercontent.com/a/b/main/League Skin.fantome")
        );

        assert_eq!(
            query_pairs(&deep_link(url, "A")).get("url").map(String::as_str),
            Some(url)
        );
    }

    #[test]
    fn soru_isareti_ve_eter_sanlari_degeri_bolmez() {
        let url = "https://raw.githubusercontent.com/a/b/main/R%26D%20Skin.fantome?x=1";
        let pairs = query_pairs(&deep_link(url, "A&B?C#D"));
        assert_eq!(pairs.get("url").map(String::as_str), Some(url));
        assert_eq!(pairs.get("name").map(String::as_str), Some("A&B?C#D"));
    }

    #[test]
    fn slug_baslik_bicimine_cevrilir() {
        assert_eq!(
            title_case_slug("guardian-of-the-sands-rengar"),
            "Guardian Of The Sands Rengar"
        );
        assert_eq!(title_case_slug("my_mod"), "My Mod");
        assert_eq!(title_case_slug(""), "");
    }

    #[test]
    fn kutuphane_etkin_modu_ve_profili_cozer() {
        let json: serde_json::Value = serde_json::from_str(
            r#"{
                "version": 2,
                "mods": [
                    { "id": "m1", "format": "fantome", "slug": "a-mod", "installedAt": "2026-01-01T00:00:00Z" },
                    { "id": "m2", "format": "modpkg", "slug": "b-mod", "installedAt": "2026-01-02T00:00:00Z" }
                ],
                "profiles": [
                    { "id": "p1", "name": "Default", "enabledMods": ["m1"] }
                ],
                "activeProfileId": "p1",
                "folders": [ { "id": "root", "name": "", "modIds": ["m1", "m2"] } ],
                "folderOrder": ["root"]
            }"#,
        )
        .expect("ornek kutuphane cozulemedi");

        let library = build_library(&json, Path::new("C:/yok/boyle/bir/yol"));
        assert_eq!(library.active_profile.as_deref(), Some("Default"));
        assert_eq!(library.profiles, vec!["Default"]);
        assert_eq!(library.mods.len(), 2);
        assert_eq!(library.mods[0].id, "m1");
        assert!(library.mods[0].enabled);
        assert_eq!(library.mods[0].name, "A Mod");
        assert_eq!(library.mods[1].id, "m2");
        assert!(!library.mods[1].enabled);
    }

    #[test]
    fn etkin_olmayan_profil_bos_kabul_edilir() {
        let json: serde_json::Value = serde_json::from_str(
            r#"{
                "mods": [ { "id": "m1", "slug": "a-mod" } ],
                "profiles": [ { "id": "p1", "name": "Default", "enabledMods": [] } ],
                "activeProfileId": "p1"
            }"#,
        )
        .expect("ornek kutuphane cozulemedi");

        let library = build_library(&json, Path::new("C:/yok"));
        assert_eq!(library.mods.len(), 1);
        assert!(!library.mods[0].enabled);
        assert_eq!(library.mods[0].name, "A Mod");
    }

    #[test]
    fn registry_koku_buyuk_kucuk_fark_etmez() {
        assert!(hive_of("HKEY_CURRENT_USER\\Software\\X").is_some());
        assert!(hive_of("hkcu\\Software\\X").is_some());
        assert!(hive_of("HKEY_LOCAL_MACHINE\\SOFTWARE\\X").is_some());
        assert!(hive_of("hklm\\SOFTWARE\\X").is_some());
        assert!(hive_of("HKCR\\Folder").is_some());
        assert!(hive_of("HKEY_USERS\\.DEFAULT").is_some());
        assert!(hive_of("HKEY_CURRENT_CONFIG\\Software").is_none());
        assert!(hive_of("Software\\X").is_none());
        assert!(hive_of("").is_none());
    }

    #[test]
    fn registry_degeri_kucuk_harfle_alinir() {
        let value = reg_query(
            "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion",
            "productname",
        );
        assert!(value.is_some_and(|v| !v.trim().is_empty()));
    }

    fn sample_library() -> serde_json::Value {
        serde_json::from_str(
            r#"{
                "mods": [ { "id": "m1" }, { "id": "m2" } ],
                "profiles": [
                    { "id": "p1", "name": "Default", "enabledMods": ["m1"] },
                    { "id": "p2", "name": "Ikinci", "enabledMods": [] }
                ],
                "activeProfileId": "p1"
            }"#,
        )
        .expect("ornek kutuphane cozulemedi")
    }

    fn enabled_ids(json: &serde_json::Value) -> Vec<String> {
        json.get("profiles")
            .and_then(|v| v.as_array())
            .and_then(|list| list.first())
            .and_then(|p| p.get("enabledMods"))
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default()
    }

    #[test]
    fn mod_durumu_ekler_ve_cikarir() {
        let mut json = sample_library();
        set_mod_enabled_in_json(&mut json, "m2", true).expect("eklenemedi");
        assert_eq!(enabled_ids(&json), vec!["m1", "m2"]);

        set_mod_enabled_in_json(&mut json, "m1", false).expect("cikarilamadi");
        assert_eq!(enabled_ids(&json), vec!["m2"]);

        set_mod_enabled_in_json(&mut json, "m2", false).expect("cikarilamadi");
        assert!(enabled_ids(&json).is_empty());
    }

    #[test]
    fn mod_durumu_tekrar_uygulanabilir_ve_bilinmeyen_mod_hata_verir() {
        let mut json = sample_library();
        set_mod_enabled_in_json(&mut json, "m1", true).expect("eklenemedi");
        set_mod_enabled_in_json(&mut json, "m1", true).expect("eklenemedi");
        assert_eq!(enabled_ids(&json), vec!["m1"]);

        set_mod_enabled_in_json(&mut json, "m1", false).expect("cikarilamadi");
        set_mod_enabled_in_json(&mut json, "m1", false).expect("cikarilamadi");
        assert!(enabled_ids(&json).is_empty());

        assert!(set_mod_enabled_in_json(&mut json, "yok", true).is_err());
    }

    #[test]
    fn etkin_profil_yoksa_ilk_profil_kullanilir() {
        let mut json = sample_library();
        json["activeProfileId"] = serde_json::Value::String("p9".into());
        set_mod_enabled_in_json(&mut json, "m2", true).expect("eklenemedi");
        assert_eq!(enabled_ids(&json), vec!["m1", "m2"]);
    }

    #[tokio::test]
    async fn metin_dosyasi_yazilip_okunur() {
        let dir = std::env::temp_dir().join(format!("void-test-{}", now_ms()));
        let path = dir.join("yedek.json");
        let path_text = path.to_string_lossy().to_string();
        let content = "{\"favorites\":[1,2,3]}";
        save_text_file(path_text.clone(), content.into())
            .await
            .expect("yazilamadi");
        let loaded = load_text_file(path_text.clone()).await.expect("okunamadi");
        assert_eq!(loaded, content);
        let _ = std::fs::remove_dir_all(&dir);

        assert!(save_text_file("  ".into(), "x".into()).await.is_err());
    }

    #[test]
    fn onbellek_istatistigi_dosyalari_sayar() {
        let dir = std::env::temp_dir().join(format!("void-cache-{}", now_ms()));
        std::fs::create_dir_all(&dir).expect("dizin olusturulamadi");
        std::fs::write(dir.join("a.png"), vec![0u8; 2048]).expect("yazilamadi");
        std::fs::write(dir.join("b.png"), vec![0u8; 1024]).expect("yazilamadi");
        let stats = cache_dir_stats(&dir);
        assert_eq!(stats.files, 2);
        assert!((stats.mb - 0.0029296875).abs() < 0.0001);

        let missing = dir.join("yok");
        let empty = cache_dir_stats(&missing);
        assert_eq!(empty.files, 0);
        assert_eq!(empty.mb, 0.0);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn toplu_mod_guncellemesi_modlari_toplu_isler() {
        let mut json = sample_library();
        for id in ["m1", "m2"] {
            set_mod_enabled_in_json(&mut json, id, true).expect("eklenemedi");
        }
        assert_eq!(enabled_ids(&json).len(), 2);

        set_mod_enabled_in_json(&mut json, "m1", false).expect("cikarilamadi");
        assert_eq!(enabled_ids(&json), vec!["m2"]);
    }

    #[tokio::test]
    async fn klasor_icerigi_siralanir() {
        let dir = std::env::temp_dir().join(format!("void-dir-{}", now_ms()));
        std::fs::create_dir_all(dir.join("alt")).expect("dizin olusturulamadi");
        std::fs::write(dir.join("b.txt"), b"x").expect("yazilamadi");
        std::fs::write(dir.join("a.txt"), b"xx").expect("yazilamadi");

        let entries = list_dir_entries(dir.to_string_lossy().to_string())
            .await
            .expect("liste alinamadi");
        assert_eq!(entries.len(), 3);
        assert!(entries[0].is_dir);
        assert_eq!(entries[1].name, "a.txt");
        assert_eq!(entries[2].size_kb, 0);

        assert!(list_dir_entries(dir.join("yok").to_string_lossy().to_string())
            .await
            .is_err());

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn yedek_listesi_yalnzca_kutuphane_dosyalarini_icerir() {
        let dir = std::env::temp_dir().join(format!("void-bk-{}", now_ms()));
        std::fs::create_dir_all(&dir).expect("dizin olusturulamadi");
        std::fs::write(dir.join("library.json"), b"{}").expect("yazilamadi");
        std::fs::write(dir.join("library.json.void-backup"), b"{}").expect("yazilamadi");
        std::fs::write(dir.join("baska.txt"), b"x").expect("yazilamadi");

        let backups = collect_backups(&dir);
        assert_eq!(backups.len(), 2);
        assert!(backups.iter().all(|b| b.name.starts_with("library")));

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn mod_sagligi_klasör_ve_kayit_sorunlarini_bulur() {
        let dir = std::env::temp_dir().join(format!("void-health-{}", now_ms()));
        let mods_dir = dir.join("mods");
        std::fs::create_dir_all(mods_dir.join("iyi-mod")).expect("dizin olusturulamadi");
        std::fs::write(
            mods_dir.join("iyi-mod").join("mod.config.json"),
            br#"{"display_name":"Iyi Mod","version":"1.0.0"}"#,
        )
        .expect("yazilamadi");
        std::fs::create_dir_all(mods_dir.join("bos-mod")).expect("dizin olusturulamadi");
        std::fs::create_dir_all(mods_dir.join("config-siz-mod")).expect("dizin olusturulamadi");
        std::fs::write(
            mods_dir.join("config-siz-mod").join("payload.bin"),
            b"x",
        )
        .expect("yazilamadi");

        let json: serde_json::Value = serde_json::from_str(
            r#"{
                "mods": [
                    { "id": "m1", "slug": "iyi-mod", "format": "fantome" },
                    { "id": "m2", "slug": "bos-mod", "format": "fantome" },
                    { "id": "m3", "slug": "config-siz-mod", "format": "modpkg" },
                    { "id": "m4", "slug": "yok-mod", "format": "fantome" }
                ]
            }"#,
        )
        .expect("ornek kutuphane cozulemedi");

        let issues = mod_health_issues(&json, &mods_dir);
        let has = |code: &str| issues.iter().any(|i| i.code == code);

        assert!(has("missing_folder"));
        assert!(has("empty_folder"));
        assert!(has("missing_config"));
        assert_eq!(
            issues.iter().filter(|i| i.severity == "error").count(),
            1
        );
        assert!(issues
            .iter()
            .all(|i| !i.mod_id.is_empty() && !i.message.is_empty()));

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn mod_sagligi_tekrar_kimligi_esas_alan_olarak_bildirir() {
        let json: serde_json::Value = serde_json::from_str(
            r#"{
                "mods": [
                    { "id": "m1", "slug": "a" },
                    { "id": "m1", "slug": "b" }
                ]
            }"#,
        )
        .expect("ornek kutuphane cozulemedi");

        let issues = mod_health_issues(&json, Path::new("C:/yok"));
        assert!(issues.iter().any(|i| i.code == "duplicate_id"));
    }
}
