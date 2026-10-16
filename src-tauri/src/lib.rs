#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::Manager;

static HTTP: OnceLock<reqwest::Client> = OnceLock::new();
static LCU_HTTP: OnceLock<reqwest::Client> = OnceLock::new();

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
        if part.is_empty() || part == "." || part == ".." {
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

fn reg_query(key: &str, value: &str) -> Option<String> {
    use std::process::Command;
    let output = Command::new("reg")
        .args(["query", key, "/v", value])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    for line in text.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with(value) {
            continue;
        }
        if let Some(idx) = trimmed.find("REG_") {
            let after = &trimmed[idx..];
            let mut parts = after.splitn(2, char::is_whitespace);
            parts.next();
            if let Some(rest) = parts.next() {
                let path = rest.trim();
                if !path.is_empty() {
                    return Some(path.to_string());
                }
            }
        }
    }
    None
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
    if let Some((_, path)) = detect_from_metadata("riot_client") {
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

fn reg_default(key: &str) -> Option<String> {
    use std::process::Command;
    let output = Command::new("reg")
        .args(["query", key, "/ve"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    for line in text.lines() {
        if let Some(idx) = line.find("REG_SZ") {
            let value = line[idx + "REG_SZ".len()..].trim();
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
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
        let output = std::process::Command::new("tasklist")
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
    let src = source.unwrap_or_else(|| "VOID".into());
    params.push_str(&format!("&source={}", pct_encode(&src)));
    let deep_link = format!("ltk://install?{params}");
    let exe = ltk_manager_exe().ok_or_else(|| {
        "LTK Manager kurulu değil. LTK Manager'ı yükledikten sonra tekrar deneyin.".to_string()
    })?;
    std::process::Command::new(exe)
        .arg(&deep_link)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("LTK Manager başlatılamadı: {e}"))
}

#[tauri::command]
async fn ltk_open() -> Result<(), String> {
    let exe = ltk_manager_exe().ok_or_else(|| "LTK Manager bulunamadı".to_string())?;
    std::process::Command::new(exe)
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
    std::process::Command::new(exe)
        .arg(pkg)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
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
    let mod_engine_ready = league.found;
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
    if let Some(parent) = full.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(&full, &text);
    Ok(text)
}

#[tauri::command]
async fn download_to_cache(
    url: String,
    cache_key: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let base = cache_base(&app)?;
    let rel = safe_relative(&cache_key);
    let full = base.join(&rel);
    if !full.starts_with(&base) {
        return Err("geçersiz yol".into());
    }
    if full.exists() {
        if let Ok(meta) = fs::metadata(&full) {
            if meta.len() > 0 {
                return Ok(full.to_string_lossy().to_string());
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
    if let Some(parent) = full.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&full, &bytes).map_err(|e| e.to_string())?;
    Ok(full.to_string_lossy().to_string())
}

#[tauri::command]
async fn cache_resolve(cache_key: String, app: tauri::AppHandle) -> Option<String> {
    let base = cache_base(&app).ok()?;
    let full = base.join(safe_relative(&cache_key));
    if full.starts_with(&base) && full.exists() {
        Some(full.to_string_lossy().to_string())
    } else {
        None
    }
}

#[tauri::command]
async fn clear_image_cache(app: tauri::AppHandle) -> Result<u64, String> {
    let base = cache_base(&app)?;
    let images = base.join("images");
    let freed = dir_size_mb(&images) as u64;
    if images.exists() {
        fs::remove_dir_all(&images).map_err(|e| e.to_string())?;
    }
    Ok(freed)
}

#[tauri::command]
async fn open_folder(path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(target)
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
    let mut written = Vec::new();
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
        std::io::copy(&mut entry, &mut outfile).map_err(|e| e.to_string())?;
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
    for f in &files {
        if let Some(name) = PathBuf::from(f).file_name() {
            let dest = active.join(format!("{}_{}", req.skin_id, name.to_string_lossy()));
            let _ = fs::copy(f, &dest);
        }
    }
    let _ = fs::remove_dir_all(&staging);
    Ok(PatchResult {
        success: true,
        message: format!("Kostüm uygulandı ({} paketi, {} dosya)", req.archive_format, files.len()),
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
    if active.exists() {
        let _ = fs::remove_dir_all(&active);
    }
    Ok(PatchResult {
        success: true,
        message: "Son patch geri alındı.".into(),
        backup_path: None,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
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
            open_folder,
            extract_mod_package,
            apply_mod,
            revert_last_patch,
            ltk_manager_status,
            ltk_install,
            ltk_open,
            ltk_import_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::pct_encode;

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
}
