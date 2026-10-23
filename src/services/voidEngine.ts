import { invoke } from "@tauri-apps/api/core";

export interface VoidMod {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  path: string;
  source: string;
  champions: string[];
  tags: string[];
  layers: string[];
  thumbnail: string | null;
  skinId: number | null;
}

export interface VoidModsPaths {
  root: string;
  modsDir: string;
  libraryFile: string;
  profileDir: string;
  overlayDir: string;
  stateDir: string;
  gameDir: string | null;
}

export interface OverlaySummary {
  overlayRoot: string;
  built: string[];
  reused: string[];
  skippedArchives: string[];
  checksumMismatches: string[];
  buildTimeMs: number;
}

export interface OverlayProgress {
  stage: string;
  currentFile: string | null;
  current: number;
  total: number;
}

export interface PatcherStatus {
  available: boolean;
  hostPath: string | null;
  dllPath: string | null;
  source: string;
  running: boolean;
  state: string;
  lastMessage: string;
  logCount: number;
}

export interface PatcherEvent {
  kind: "ok" | "status" | "error" | "dll" | "log";
  timestamp: string;
  state: string | null;
  level: string | null;
  message: string;
}

export interface PatcherOption {
  value: number;
  label: string;
  description: string;
}

export interface PatcherConfig {
  logLevels: PatcherOption[];
  hookFlags: PatcherOption[];
  defaultFlags: number;
}

export interface OverlayStatus {
  exists: boolean;
  overlayDir: string;
  fileCount: number;
  totalBytes: number;
  lastBuiltMs: number | null;
  stale: boolean;
  enabledMods: number;
}

export interface ModHealth {
  id: string;
  name: string;
  enabled: boolean;
  healthy: boolean;
  issues: string[];
}

export interface Diagnostics {
  appVersion: string;
  leagueFound: boolean;
  leaguePath: string | null;
  gameDir: string | null;
  voidRoot: string;
  modCount: number;
  enabledCount: number;
  brokenMods: number;
  overlayExists: boolean;
  overlayStale: boolean;
  patcherAvailable: boolean;
  patcherPath: string | null;
}

export async function voidModsPaths(): Promise<VoidModsPaths> {
  return invoke<VoidModsPaths>("void_mods_paths");
}

export async function voidModsList(): Promise<VoidMod[]> {
  return invoke<VoidMod[]>("void_mods_list");
}

export async function voidModsImport(packagePath: string): Promise<VoidMod> {
  return invoke<VoidMod>("void_mods_import", { packagePath });
}

export async function voidModsSetEnabled(
  id: string,
  enabled: boolean,
): Promise<VoidMod[]> {
  return invoke<VoidMod[]>("void_mods_set_enabled", { id, enabled });
}

export async function voidModsRemove(id: string): Promise<VoidMod[]> {
  return invoke<VoidMod[]>("void_mods_remove", { id });
}

export async function voidModsBuildOverlay(): Promise<OverlaySummary> {
  return invoke<OverlaySummary>("void_mods_build_overlay");
}

export async function voidModsImportForSkin(
  packagePath: string,
  skinId: number,
): Promise<VoidMod> {
  return invoke<VoidMod>("void_mods_import_for_skin", { packagePath, skinId });
}

export async function voidModsRemoveBySkin(skinId: number): Promise<VoidMod[]> {
  return invoke<VoidMod[]>("void_mods_remove_by_skin", { skinId });
}

export async function voidModsSetEnabledMany(
  ids: string[],
  enabled: boolean,
): Promise<VoidMod[]> {
  return invoke<VoidMod[]>("void_mods_set_enabled_many", { ids, enabled });
}

export async function voidOverlayStatus(): Promise<OverlayStatus> {
  return invoke<OverlayStatus>("void_overlay_status");
}

export async function voidModsHealth(): Promise<ModHealth[]> {
  return invoke<ModHealth[]>("void_mods_health");
}

export async function voidDiagnostics(): Promise<Diagnostics> {
  return invoke<Diagnostics>("void_diagnostics");
}

export async function voidPatcherStatus(): Promise<PatcherStatus> {
  return invoke<PatcherStatus>("void_patcher_status");
}

export async function voidPatcherConfig(): Promise<PatcherConfig> {
  return invoke<PatcherConfig>("void_patcher_config");
}

export async function voidPatcherStart(
  prefix?: string,
  logLevel?: number,
  flags?: number,
): Promise<PatcherStatus> {
  return invoke<PatcherStatus>("void_patcher_start", {
    prefix: prefix ?? null,
    logLevel: logLevel ?? null,
    flags: flags ?? null,
  });
}

export async function voidPatcherStop(): Promise<void> {
  return invoke("void_patcher_stop");
}

export async function voidPatcherLogs(): Promise<string[]> {
  return invoke<string[]>("void_patcher_logs");
}
