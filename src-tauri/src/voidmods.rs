use camino::Utf8PathBuf;
use ltk_mod_project::fantome::FantomeImporter;
use ltk_mod_project::modpkg::ModpkgImporter;
use ltk_mod_project::ProjectImporter;
use ltk_overlay::{EnabledMod, FsModContent, OverlayBuilder};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

const LIBRARY_VERSION: u32 = 1;
const MAX_LIBRARY_BYTES: u64 = 8 * 1024 * 1024;

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct VoidMod {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub enabled: bool,
    pub path: String,
    #[serde(default)]
    pub source: String,
    #[serde(default)]
    pub champions: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub layers: Vec<String>,
    #[serde(default)]
    pub thumbnail: Option<String>,
    #[serde(default)]
    pub skin_id: Option<u32>,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct LibraryFile {
    #[serde(default)]
    version: u32,
    #[serde(default)]
    mods: Vec<VoidMod>,
}

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct VoidModsPaths {
    pub root: String,
    pub mods_dir: String,
    pub library_file: String,
    pub profile_dir: String,
    pub overlay_dir: String,
    pub state_dir: String,
    pub game_dir: Option<String>,
}

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct OverlaySummary {
    pub overlay_root: String,
    pub built: Vec<String>,
    pub reused: Vec<String>,
    pub skipped_archives: Vec<String>,
    pub checksum_mismatches: Vec<String>,
    pub build_time_ms: u64,
}

fn appdata() -> Result<PathBuf, String> {
    std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .ok_or_else(|| "APPDATA bulunamadı.".to_string())
}

pub fn void_root() -> Result<PathBuf, String> {
    Ok(appdata()?.join("VOID"))
}

pub fn mods_dir() -> Result<PathBuf, String> {
    Ok(void_root()?.join("mods"))
}

pub fn library_file() -> Result<PathBuf, String> {
    Ok(void_root()?.join("library.json"))
}

pub fn profile_dir() -> Result<PathBuf, String> {
    Ok(void_root()?.join("profiles").join("default"))
}

pub fn overlay_dir() -> Result<PathBuf, String> {
    Ok(profile_dir()?.join("overlay"))
}

pub fn state_dir() -> Result<PathBuf, String> {
    Ok(profile_dir()?.join("state"))
}

pub fn paths() -> Result<VoidModsPaths, String> {
    let game = resolve_game_dir();
    Ok(VoidModsPaths {
        root: void_root()?.to_string_lossy().to_string(),
        mods_dir: mods_dir()?.to_string_lossy().to_string(),
        library_file: library_file()?.to_string_lossy().to_string(),
        profile_dir: profile_dir()?.to_string_lossy().to_string(),
        overlay_dir: overlay_dir()?.to_string_lossy().to_string(),
        state_dir: state_dir()?.to_string_lossy().to_string(),
        game_dir: game.map(|p| p.to_string_lossy().to_string()),
    })
}

pub fn resolve_game_dir() -> Option<PathBuf> {
    let detected = crate::detect_league().path?;
    let base = PathBuf::from(detected);
    let candidates = [base.join("Game"), base];
    candidates
        .into_iter()
        .find(|c| c.join("DATA").join("FINAL").is_dir())
}

fn read_library() -> Result<Vec<VoidMod>, String> {
    let path = library_file()?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let meta = fs::metadata(&path).map_err(|e| format!("Kütüphane okunamadı: {e}"))?;
    if meta.len() > MAX_LIBRARY_BYTES {
        return Err("Kütüphane dosyası beklenmedik boyutta.".to_string());
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("Kütüphane okunamadı: {e}"))?;
    let parsed: LibraryFile = serde_json::from_str(&raw).unwrap_or_default();
    Ok(parsed.mods)
}

fn write_library(mods: &[VoidMod]) -> Result<(), String> {
    let path = library_file()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Kütüphane klasörü oluşturulamadı: {e}"))?;
    }
    let file = LibraryFile {
        version: LIBRARY_VERSION,
        mods: mods.to_vec(),
    };
    let bytes = serde_json::to_vec_pretty(&file).map_err(|e| format!("Kütüphane yazılamadı: {e}"))?;
    crate::write_atomic(&path, &bytes).map_err(|e| format!("Kütüphane yazılamadı: {e}"))
}

pub fn list_mods() -> Result<Vec<VoidMod>, String> {
    read_library()
}

pub fn list_enabled_mods() -> Result<Vec<VoidMod>, String> {
    Ok(read_library()?.into_iter().filter(|m| m.enabled).collect())
}

pub fn set_enabled(id: &str, enabled: bool) -> Result<Vec<VoidMod>, String> {
    let mut mods = read_library()?;
    let mut found = false;
    for entry in mods.iter_mut() {
        if entry.id == id {
            entry.enabled = enabled;
            found = true;
            break;
        }
    }
    if !found {
        return Err(format!("Mod bulunamadı: {id}"));
    }
    write_library(&mods)?;
    Ok(mods)
}

pub fn remove_mod(id: &str) -> Result<Vec<VoidMod>, String> {
    let mut mods = read_library()?;
    let index = mods
        .iter()
        .position(|m| m.id == id)
        .ok_or_else(|| format!("Mod bulunamadı: {id}"))?;
    let removed = mods.remove(index);
    write_library(&mods)?;
    let dir = PathBuf::from(&removed.path);
    if dir.starts_with(mods_dir().unwrap_or_default()) && dir.is_dir() {
        let _ = fs::remove_dir_all(dir);
    }
    Ok(mods)
}

pub fn import_for_skin(package_path: &Path, skin_id: u32) -> Result<VoidMod, String> {
    let mut mods = read_library()?;
    if let Some(existing) = mods.iter_mut().find(|m| m.skin_id == Some(skin_id)) {
        existing.enabled = true;
        let result = existing.clone();
        write_library(&mods)?;
        return Ok(result);
    }
    let entry = import_package(package_path)?;
    let mut mods = read_library()?;
    let mut result = entry.clone();
    if let Some(stored) = mods.iter_mut().find(|m| m.id == entry.id) {
        stored.skin_id = Some(skin_id);
        stored.enabled = true;
        result = stored.clone();
    }
    write_library(&mods)?;
    Ok(result)
}

pub fn remove_by_skin(skin_id: u32) -> Result<Vec<VoidMod>, String> {
    let mods = read_library()?;
    let mut kept: Vec<VoidMod> = Vec::with_capacity(mods.len());
    let mut removed_dirs: Vec<String> = Vec::new();
    for entry in mods {
        if entry.skin_id == Some(skin_id) {
            removed_dirs.push(entry.path);
        } else {
            kept.push(entry);
        }
    }
    if removed_dirs.is_empty() {
        return Ok(kept);
    }
    write_library(&kept)?;
    let root = mods_dir().unwrap_or_default();
    for path in removed_dirs {
        let dir = PathBuf::from(path);
        if dir.starts_with(&root) && dir.is_dir() {
            let _ = fs::remove_dir_all(dir);
        }
    }
    Ok(kept)
}

pub fn set_enabled_many(ids: &[String], enabled: bool) -> Result<Vec<VoidMod>, String> {
    let mut mods = read_library()?;
    for entry in mods.iter_mut() {
        if ids.iter().any(|id| id == &entry.id) {
            entry.enabled = enabled;
        }
    }
    write_library(&mods)?;
    Ok(mods)
}

fn sanitize_id(raw: &str) -> String {
    let mut out = String::new();
    for ch in raw.chars() {
        if ch.is_ascii_alphanumeric() || ch == '_' || ch == '-' {
            out.push(ch);
        } else if !out.ends_with('_') {
            out.push('_');
        }
    }
    let out = out.trim_matches('_').to_string();
    if out.is_empty() {
        "mod".to_string()
    } else {
        out.to_ascii_lowercase()
    }
}

fn unique_id(base: &str, taken: &[VoidMod]) -> String {
    if !taken.iter().any(|m| m.id == base) {
        return base.to_string();
    }
    let mut n = 2;
    loop {
        let candidate = format!("{base}_{n}");
        if !taken.iter().any(|m| m.id == candidate) {
            return candidate;
        }
        n += 1;
    }
}

fn utf8(path: &Path) -> Result<Utf8PathBuf, String> {
    Utf8PathBuf::from_path_buf(path.to_path_buf())
        .map_err(|_| "Yol UTF-8 olarak temsil edilemiyor.".to_string())
}

pub fn import_package(package_path: &Path) -> Result<VoidMod, String> {
    if !package_path.is_file() {
        return Err("Paket dosyası bulunamadı.".to_string());
    }
    let extension = package_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if extension != "modpkg" && extension != "fantome" {
        return Err("Desteklenmeyen paket biçimi (.modpkg veya .fantome olmalı).".to_string());
    }

    let mods_root = mods_dir()?;
    fs::create_dir_all(&mods_root).map_err(|e| format!("Mod klasörü oluşturulamadı: {e}"))?;

    let mut existing = read_library()?;
    let stem = package_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("mod");
    let id = unique_id(&sanitize_id(stem), &existing);
    let dest = mods_root.join(&id);
    if dest.exists() {
        fs::remove_dir_all(&dest).map_err(|e| format!("Eski mod klasörü silinemedi: {e}"))?;
    }
    fs::create_dir_all(&dest).map_err(|e| format!("Mod klasörü oluşturulamadı: {e}"))?;
    let dest_utf8 = utf8(&dest)?;

    let project = match extension.as_str() {
        "modpkg" => {
            let file = fs::File::open(package_path)
                .map_err(|e| format!("Paket açılamadı: {e}"))?;
            ProjectImporter::new(dest_utf8.clone())
                .import(ModpkgImporter::new(file))
                .map_err(|e| format!("Paket içe aktarılamadı: {e}"))?
        }
        _ => {
            let file = fs::File::open(package_path)
                .map_err(|e| format!("Paket açılamadı: {e}"))?;
            ProjectImporter::new(dest_utf8.clone())
                .import(FantomeImporter::new(file))
                .map_err(|e| format!("Paket içe aktarılamadı: {e}"))?
        }
    };

    let layers = project
        .layers
        .iter()
        .map(|l| l.name.clone())
        .collect::<Vec<_>>();

    let entry = VoidMod {
        id: id.clone(),
        name: if project.display_name.trim().is_empty() {
            project.name.clone()
        } else {
            project.display_name.clone()
        },
        version: project.version.clone(),
        description: project.description.clone(),
        enabled: true,
        path: dest.to_string_lossy().to_string(),
        source: extension,
        champions: project.champions.clone(),
        tags: project.tags.iter().map(|t| t.to_string()).collect::<Vec<_>>(),
        layers,
        thumbnail: project.thumbnail.clone(),
        skin_id: None,
    };

    existing.push(entry.clone());
    write_library(&existing)?;
    Ok(entry)
}

pub fn build_overlay(app: tauri::AppHandle) -> Result<OverlaySummary, String> {
    let game_dir = resolve_game_dir().ok_or_else(|| {
        "League of Legends kurulumu bulunamadı (DATA/FINAL yok).".to_string()
    })?;

    let enabled = list_enabled_mods()?;
    if enabled.is_empty() {
        return Err("Etkin mod yok.".to_string());
    }

    let overlay = overlay_dir()?;
    let state = state_dir()?;
    fs::create_dir_all(&overlay).map_err(|e| format!("Overlay klasörü oluşturulamadı: {e}"))?;
    fs::create_dir_all(&state).map_err(|e| format!("Durum klasörü oluşturulamadı: {e}"))?;

    let mut mods: Vec<EnabledMod> = Vec::new();
    for entry in &enabled {
        let dir = PathBuf::from(&entry.path);
        if !dir.is_dir() {
            continue;
        }
        let content = FsModContent::new(utf8(&dir)?);
        mods.push(EnabledMod {
            id: entry.id.clone(),
            content: Box::new(content),
            enabled_layers: None,
        });
    }
    if mods.is_empty() {
        return Err("Etkin mod klasörleri bulunamadı.".to_string());
    }

    let emit_app = app.clone();
    let mut builder = OverlayBuilder::new(utf8(&game_dir)?, utf8(&overlay)?, utf8(&state)?)
        .with_progress(move |progress| {
            use tauri::Emitter;
            let _ = emit_app.emit("void-overlay-progress", progress);
        });
    builder.set_enabled_mods(mods);

    let result = builder.build().map_err(|e| format!("Overlay derlenemedi: {e}"))?;

    Ok(OverlaySummary {
        overlay_root: result.overlay_root.to_string(),
        built: result
            .wads_built
            .iter()
            .map(|p| p.to_string())
            .collect::<Vec<_>>(),
        reused: result
            .wads_reused
            .iter()
            .map(|p| p.to_string())
            .collect::<Vec<_>>(),
        skipped_archives: result
            .skipped_archives
            .iter()
            .map(|a| a.name.clone())
            .collect::<Vec<_>>(),
        checksum_mismatches: result
            .checksum_mismatches
            .iter()
            .map(|c| format!("{} / {}", c.mod_id, c.wad_name))
            .collect::<Vec<_>>(),
        build_time_ms: result.build_time.as_millis() as u64,
    })
}

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct OverlayStatus {
    pub exists: bool,
    pub overlay_dir: String,
    pub file_count: u64,
    pub total_bytes: u64,
    pub last_built_ms: Option<u64>,
    pub stale: bool,
    pub enabled_mods: usize,
}

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ModHealth {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub healthy: bool,
    pub issues: Vec<String>,
}

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostics {
    pub app_version: String,
    pub league_found: bool,
    pub league_path: Option<String>,
    pub game_dir: Option<String>,
    pub void_root: String,
    pub mod_count: usize,
    pub enabled_count: usize,
    pub broken_mods: usize,
    pub overlay_exists: bool,
    pub overlay_stale: bool,
    pub patcher_available: bool,
    pub patcher_path: Option<String>,
}

fn scan_dir(dir: &Path) -> (u64, u64, Option<u64>) {
    let mut files = 0u64;
    let mut bytes = 0u64;
    let mut newest: Option<u64> = None;
    let mut stack = vec![dir.to_path_buf()];
    while let Some(current) = stack.pop() {
        let entries = match fs::read_dir(&current) {
            Ok(entries) => entries,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let meta = match entry.metadata() {
                Ok(meta) => meta,
                Err(_) => continue,
            };
            if meta.is_dir() {
                stack.push(path);
                continue;
            }
            files += 1;
            bytes += meta.len();
            if let Ok(modified) = meta.modified() {
                if let Ok(dur) = modified.duration_since(std::time::UNIX_EPOCH) {
                    let ms = dur.as_millis() as u64;
                    newest = Some(newest.map_or(ms, |current| current.max(ms)));
                }
            }
        }
    }
    (files, bytes, newest)
}

pub fn overlay_status() -> Result<OverlayStatus, String> {
    let overlay = overlay_dir()?;
    let enabled = list_enabled_mods()?;
    let (file_count, total_bytes, last_built_ms) = if overlay.is_dir() {
        scan_dir(&overlay)
    } else {
        (0, 0, None)
    };
    let mut stale = file_count == 0 && !enabled.is_empty();
    if let Some(built) = last_built_ms {
        for entry in &enabled {
            let (_, _, newest) = scan_dir(Path::new(&entry.path));
            if newest.map_or(false, |ms| ms > built) {
                stale = true;
                break;
            }
        }
    }
    Ok(OverlayStatus {
        exists: file_count > 0,
        overlay_dir: overlay.to_string_lossy().to_string(),
        file_count,
        total_bytes,
        last_built_ms,
        stale,
        enabled_mods: enabled.len(),
    })
}

pub fn mods_health() -> Result<Vec<ModHealth>, String> {
    let mods = read_library()?;
    let mut out = Vec::with_capacity(mods.len());
    for entry in mods {
        let mut issues: Vec<String> = Vec::new();
        let dir = PathBuf::from(&entry.path);
        if !dir.is_dir() {
            issues.push("Mod klasörü bulunamadı".to_string());
        } else {
            let (files, _, _) = scan_dir(&dir);
            if files == 0 {
                issues.push("Mod klasörü boş".to_string());
            }
        }
        if entry.layers.is_empty() {
            issues.push("Katman bilgisi yok".to_string());
        }
        out.push(ModHealth {
            healthy: issues.is_empty(),
            id: entry.id,
            name: entry.name,
            enabled: entry.enabled,
            issues,
        });
    }
    Ok(out)
}

pub fn diagnostics(app_version: String, patcher_available: bool, patcher_path: Option<String>) -> Diagnostics {
    let league = crate::detect_league();
    let game_dir = resolve_game_dir();
    let mods = read_library().unwrap_or_default();
    let enabled_count = mods.iter().filter(|m| m.enabled).count();
    let broken_mods = mods
        .iter()
        .filter(|m| !Path::new(&m.path).is_dir())
        .count();
    let overlay = overlay_status().unwrap_or_default();
    Diagnostics {
        app_version,
        league_found: league.found,
        league_path: league.path,
        game_dir: game_dir.map(|p| p.to_string_lossy().to_string()),
        void_root: void_root()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default(),
        mod_count: mods.len(),
        enabled_count,
        broken_mods,
        overlay_exists: overlay.exists,
        overlay_stale: overlay.stale,
        patcher_available,
        patcher_path,
    }
}
