import type { SkinSourceType } from "./champion";

export interface RepositoryConfig {
  id: SkinSourceType;
  label: string;
  description: string;
  baseUrl: string;
  indexUrl: string;
  archiveUrlTemplate: string;
  layout: "bettie-index" | "id-tree" | "name-zip";
  enabled: boolean;
  weight: number;
}

export interface AppSettings {
  activeRepositories: SkinSourceType[];
  hybridMode: boolean;
  autoApply: boolean;
  autoSyncOnLaunch: boolean;
  imageCacheEnabled: boolean;
  imageCacheTtlHours: number;
  dataSource: DataSourceMode;
  leaguePath: string | null;
  riotClientPath: string | null;
  patchTargetMode: PatchTargetMode;
  sendTarget: SendTarget;
  themeAccent: ThemeAccent;
  skinNameLanguage: SkinNameLanguage;
  gridDensity: GridDensity;
  checkUpdateOnLaunch: boolean;
  customAccent: string | null;
  glowIntensity: number;
  uiRadius: UiRadius;
  animationsEnabled: boolean;
  animationSpeed: number;
  smartSuggestions: boolean;
  fuzzySearch: boolean;
  bulkModOperations: boolean;
  smartSync: boolean;
  autoPatchOnGameLaunch: boolean;
  setupCompleted: boolean;
}

export type DataSourceMode = "auto" | "online" | "lcu";

export type CatalogSource = "online" | "lcu";

export type PatchTargetMode = "fantome" | "wad-overlay" | "cslol-compatible";

export type SendTarget = "ltk" | "void";

export type ThemeAccent = "cyan" | "violet" | "magenta" | "lime";

export type SkinNameLanguage = "tr" | "en";

export type GridDensity = "compact" | "comfortable" | "large";

export type UiRadius = "sharp" | "soft" | "round";

export interface SyncProgress {
  repositoryId: SkinSourceType | "catalog";
  phase: SyncPhase;
  current: number;
  total: number;
  message: string;
}

export type SyncPhase =
  | "idle"
  | "fetching-catalog"
  | "fetching-index"
  | "parsing"
  | "merging"
  | "complete"
  | "error";

export interface SyncState {
  running: boolean;
  lastSyncedAt: number | null;
  errors: string[];
}

export const DD_EXCLUDED_SKINS = new Set<number>([0]);

export const DEFAULT_REPOSITORIES: RepositoryConfig[] = [
  {
    id: "bettie9",
    label: "Kaynak A — Bettie9 / Sunshine",
    description:
      "Sunshine/.fantome ekosistemi. index.json şampiyon adı + skin numarası ile eşlenir, CSLOL uyumlu paketler.",
    baseUrl: "https://github.com/bettie9/LeagueSkins",
    indexUrl: "https://raw.githubusercontent.com/bettie9/LeagueSkins/main/index.json",
    archiveUrlTemplate:
      "https://raw.githubusercontent.com/bettie9/LeagueSkins/main/skins/{path}",
    layout: "bettie-index",
    enabled: true,
    weight: 1,
  },
  {
    id: "alban1911",
    label: "Kaynak B — Alban1911 / Rose",
    description:
      "Rose ekosistemi. skins/{championId}/{skinId}/{skinId}.fantome yol şeması; kimlikler doğrudan yoldan okunur.",
    baseUrl: "https://github.com/Alban1911/LeagueSkins",
    indexUrl:
      "https://api.github.com/repos/Alban1911/LeagueSkins/git/trees/main?recursive=1",
    archiveUrlTemplate:
      "https://raw.githubusercontent.com/Alban1911/LeagueSkins/main/{path}",
    layout: "id-tree",
    enabled: true,
    weight: 2,
  },
  {
    id: "darkseal",
    label: "Kaynak C — darkseal-org / lol-skins",
    description:
      "Topluluk raw arşivi. skins/{Şampiyon}/{Kostüm}.zip adlandırması; geniş kapsam ve sık güncelleme.",
    baseUrl: "https://github.com/darkseal-org/lol-skins",
    indexUrl:
      "https://api.github.com/repos/darkseal-org/lol-skins/git/trees/main?recursive=1",
    archiveUrlTemplate:
      "https://raw.githubusercontent.com/darkseal-org/lol-skins/main/{path}",
    layout: "name-zip",
    enabled: true,
    weight: 3,
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  activeRepositories: ["bettie9", "alban1911", "darkseal"],
  hybridMode: true,
  autoApply: false,
  autoSyncOnLaunch: true,
  imageCacheEnabled: true,
  imageCacheTtlHours: 336,
  dataSource: "auto",
  leaguePath: null,
  riotClientPath: null,
  patchTargetMode: "fantome",
  sendTarget: "void",
  themeAccent: "cyan",
  skinNameLanguage: "tr",
  gridDensity: "compact",
  checkUpdateOnLaunch: true,
  customAccent: null,
  glowIntensity: 55,
  uiRadius: "soft",
  animationsEnabled: true,
  animationSpeed: 1,
  smartSuggestions: true,
  fuzzySearch: true,
  bulkModOperations: true,
  smartSync: true,
  autoPatchOnGameLaunch: false,
  setupCompleted: false,
};
