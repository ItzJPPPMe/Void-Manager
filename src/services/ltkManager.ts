import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";

export interface DetectResult {
  found: boolean;
  path: string | null;
  method: string | null;
}

export interface SystemStatus {
  leagueReady: boolean;
  riotClientReady: boolean;
  modEngineReady: boolean;
  leaguePath: string | null;
  riotClientPath: string | null;
  cacheSizeMb: number;
  version: string;
}

export interface PatchRequest {
  championId: number;
  skinId: number;
  packagePath: string;
  archiveFormat: string;
  targetMode: string;
}

export interface PatchResult {
  success: boolean;
  message: string;
  backupPath: string | null;
}

export interface LcuStatus {
  running: boolean;
  port: number | null;
}

export interface LtkStatus {
  found: boolean;
  installDir: string | null;
  exePath: string | null;
  gamePath: string | null;
  patcherRunning: boolean;
}

export interface LtkMod {
  id: string;
  name: string;
  version: string | null;
  authors: string[];
  description: string | null;
  champions: string[];
  format: string | null;
  enabled: boolean;
  installedAt: string | null;
  folder: string | null;
}

export interface LtkLibrary {
  mods: LtkMod[];
  activeProfile: string | null;
  profiles: string[];
  dir: string | null;
}

export interface LtkPatcherConfig {
  installed: boolean;
  alwaysStartPatcher: boolean;
  startInTray: boolean;
  autoRun: boolean;
  autostartRegistered: boolean;
}

export async function detectLeaguePath(): Promise<DetectResult> {
  return invoke<DetectResult>("detect_league_path");
}

export async function detectRiotClientPath(): Promise<DetectResult> {
  return invoke<DetectResult>("detect_riot_client_path");
}

export async function getSystemStatus(): Promise<SystemStatus> {
  return invoke<SystemStatus>("get_system_status");
}

export async function lcuStatus(): Promise<LcuStatus> {
  return invoke<LcuStatus>("lcu_status");
}

export async function ltkManagerStatus(): Promise<LtkStatus> {
  return invoke<LtkStatus>("ltk_manager_status");
}

export async function ltkInstall(
  url: string,
  name?: string,
  source?: string,
): Promise<void> {
  return invoke("ltk_install", {
    url,
    name: name ?? null,
    source: source ?? null,
  });
}

export async function ltkOpen(): Promise<void> {
  return invoke("ltk_open");
}

export async function ltkImportFile(path: string): Promise<void> {
  return invoke("ltk_import_file", { path });
}

export async function ltkLibrary(): Promise<LtkLibrary> {
  return invoke<LtkLibrary>("ltk_library");
}

export async function ltkPatcherConfig(): Promise<LtkPatcherConfig> {
  return invoke<LtkPatcherConfig>("ltk_patcher_config");
}

export async function ltkSetAutostart(enabled: boolean): Promise<LtkPatcherConfig> {
  return invoke<LtkPatcherConfig>("ltk_set_autostart", { enabled });
}

export async function ltkSetPatcherFlags(
  enabled: boolean,
): Promise<LtkPatcherConfig> {
  return invoke<LtkPatcherConfig>("ltk_set_patcher_flags", { enabled });
}

export async function ltkLaunch(): Promise<void> {
  return invoke("ltk_launch");
}

export async function fetchText(url: string): Promise<string> {
  return invoke<string>("fetch_text", { url });
}

export async function fetchTextCached(
  url: string,
  cacheKey: string,
  ttlMs: number,
): Promise<string> {
  return invoke<string>("fetch_text_cached", { url, cacheKey, ttlMs });
}

export async function downloadToCache(
  url: string,
  cacheKey: string,
  ttlMs: number,
  reuse: boolean,
): Promise<string> {
  return invoke<string>("download_to_cache", { url, cacheKey, ttlMs, reuse });
}

export async function cacheResolve(
  cacheKey: string,
  ttlMs: number,
): Promise<string | null> {
  return invoke<string | null>("cache_resolve", { cacheKey, ttlMs });
}

export async function clearImageCache(): Promise<number> {
  return invoke<number>("clear_image_cache");
}

export async function openFolder(path: string): Promise<void> {
  return invoke("open_folder", { path });
}

export async function applyMod(req: PatchRequest): Promise<PatchResult> {
  return invoke<PatchResult>("apply_mod", { req });
}

export async function revertLastPatch(): Promise<PatchResult> {
  return invoke<PatchResult>("revert_last_patch");
}

export async function extractModPackage(
  packagePath: string,
  destDir: string,
): Promise<string[]> {
  return invoke<string[]>("extract_mod_package", { packagePath, destDir });
}

export function toAssetUrl(fullPath: string): string {
  return convertFileSrc(fullPath);
}
