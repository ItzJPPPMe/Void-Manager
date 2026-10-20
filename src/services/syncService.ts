import type {
  ChampionSummary,
  Chroma,
  CommunityDragonChampionSummary,
  CommunityDragonSkin,
  CommunityDragonSkinsResponse,
  DdragonChampionFullResponse,
  Skin,
  SkinSourceType,
} from "@/types/champion";
import type {
  AppSettings,
  CatalogSource,
  DataSourceMode,
  RepositoryConfig,
  SkinNameLanguage,
  SyncProgress,
} from "@/types/settings";
import { DEFAULT_REPOSITORIES } from "@/types/settings";
import { fetchTextCached, lcuStatus } from "./ltkManager";

type ProgressListener = (progress: SyncProgress[]) => void;

const CDRAGON =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default";

const LCU_BASE = "lcu://lol-game-data/assets";

const DDRAGON_API = "https://ddragon.leagueoflegends.com/api/versions.json";

const DDRAGON_CDN = "https://ddragon.leagueoflegends.com/cdn";

const LOCALIZATION_LOCALE = "tr_TR";

const CATALOG_TTL_MS = 6 * 60 * 60 * 1000;

const CHAMPION_KEY_ALIASES: Record<string, string> = {
  monkeyking: "wukong",
  nunu: "nunuwillump",
  renata: "renataglasc",
};

function encodeRepoPath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

interface GithubTreeEntry {
  path: string;
  type: string;
  size?: number;
}

interface GithubTreeResponse {
  sha: string;
  tree: GithubTreeEntry[];
  truncated: boolean;
}

interface Bettie9Index {
  patch?: string;
  champions?: Record<
    string,
    {
      skins?: Record<string, string>;
      chromas?: Record<string, Record<string, string>>;
    }
  >;
}

export interface SyncResult {
  skins: Skin[];
  champions: ChampionSummary[];
  source: CatalogSource;
  errors: string[];
}

export class SyncService {
  private repositories: RepositoryConfig[];
  private listeners: Set<ProgressListener> = new Set();
  private progress: SyncProgress[] = [];
  private dataSource: DataSourceMode;
  private nameLanguage: SkinNameLanguage;
  private assetBase = CDRAGON;
  private packageRank = new Map<string, number>();

  constructor(settings: AppSettings) {
    this.repositories = DEFAULT_REPOSITORIES.map((repo) => ({
      ...repo,
      enabled: settings.activeRepositories.includes(repo.id),
    }));
    this.dataSource = settings.dataSource;
    this.nameLanguage = settings.skinNameLanguage;
  }

  onProgress(listener: ProgressListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  updateSettings(settings: AppSettings): void {
    this.repositories = DEFAULT_REPOSITORIES.map((repo) => ({
      ...repo,
      enabled: settings.activeRepositories.includes(repo.id),
    }));
    this.dataSource = settings.dataSource;
    this.nameLanguage = settings.skinNameLanguage;
  }

  private emit(): void {
    const snapshot = this.progress.map((p) => ({ ...p }));
    this.listeners.forEach((l) => l(snapshot));
  }

  private setProgress(
    repositoryId: SkinSourceType | "catalog",
    phase: SyncProgress["phase"],
    current: number,
    total: number,
    message: string,
  ): void {
    const entry: SyncProgress = {
      repositoryId,
      phase,
      current,
      total,
      message,
    };
    const idx = this.progress.findIndex(
      (p) => p.repositoryId === repositoryId,
    );
    if (idx >= 0) this.progress[idx] = entry;
    else this.progress.push(entry);
    this.emit();
  }

  private async resolveAssetBase(): Promise<CatalogSource> {
    if (this.dataSource === "online") {
      this.assetBase = CDRAGON;
      return "online";
    }
    try {
      const status = await lcuStatus();
      if (status.running) {
        this.assetBase = LCU_BASE;
        return "lcu";
      }
    } catch {
      this.assetBase = CDRAGON;
    }
    this.assetBase = CDRAGON;
    return "online";
  }

  private catalogScope(): string {
    return this.assetBase === LCU_BASE ? "lcu" : "online";
  }

  assetUrl(path: string | null | undefined): string {
    if (!path) return "";
    let value = path.toLowerCase();
    const marker = "/lol-game-data/assets/";
    const idx = value.indexOf(marker);
    if (idx >= 0) {
      value = value.slice(idx + marker.length);
    } else {
      const alt = "lol-game-data/assets/";
      if (value.startsWith(alt)) value = value.slice(alt.length);
      if (value.startsWith("/")) value = value.slice(1);
    }
    return `${this.assetBase}/${value}`;
  }

  championIconUrl(id: number): string {
    return `${this.assetBase}/v1/champion-icons/${id}.png`;
  }

  async syncAll(): Promise<SyncResult> {
    this.progress = [];
    this.packageRank = new Map();

    let source = await this.resolveAssetBase();

    let { skins, champions } = await this.fetchMasterCatalog();

    if (skins.length === 0 && source === "lcu") {
      this.assetBase = CDRAGON;
      source = "online";
      ({ skins, champions } = await this.fetchMasterCatalog());
    }

    if (skins.length === 0) {
      return { skins, champions, source, errors: this.collectErrors() };
    }

    const active = this.repositories.filter((r) => r.enabled);

    const championNameToId = new Map<string, number>();
    for (const c of champions) {
      championNameToId.set(this.normalizeName(c.name), c.id);
    }

    const byId = new Map<number, Skin>();
    for (const s of skins) byId.set(s.id, s);

    await Promise.allSettled(
      active.map((repo) =>
        this.applyRepository(repo, byId, championNameToId),
      ),
    );

    for (const skin of byId.values()) {
      skin.sources.sort((a, b) => this.sourceWeight(a) - this.sourceWeight(b));
    }

    const merged = Array.from(byId.values()).sort((a, b) => {
      if (a.championId !== b.championId) return a.championId - b.championId;
      return a.skinNum - b.skinNum;
    });

    if (this.nameLanguage === "tr") {
      await this.localizeTurkish(merged);
    }

    const skinCountByChampion = new Map<number, number>();
    for (const s of merged) {
      skinCountByChampion.set(
        s.championId,
        (skinCountByChampion.get(s.championId) ?? 0) + 1,
      );
    }

    const enrichedChampions = champions
      .map((c) => ({
        ...c,
        skinCount: skinCountByChampion.get(c.id) ?? 0,
      }))
      .filter((c) => c.skinCount > 0);

    return {
      skins: merged,
      champions: enrichedChampions,
      source,
      errors: this.collectErrors(),
    };
  }

  private collectErrors(): string[] {
    return this.progress
      .filter((p) => p.phase === "error")
      .map((p) => p.message);
  }

  private sourceWeight(source: SkinSourceType): number {
    const repo = DEFAULT_REPOSITORIES.find((r) => r.id === source);
    return repo ? repo.weight : Number.MAX_SAFE_INTEGER;
  }

  private rankKey(kind: "s" | "c", id: number): string {
    return `${kind}${id}`;
  }

  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim();
  }

  private async localizeTurkish(skins: Skin[]): Promise<void> {
    try {
      this.setProgress(
        "catalog",
        "fetching-catalog",
        0,
        0,
        "Türkçe kostüm adları alınıyor...",
      );
      const versionsRaw = await fetchTextCached(
        DDRAGON_API,
        "localization/ddragon-versions.json",
        CATALOG_TTL_MS,
      );
      const versions = JSON.parse(versionsRaw) as string[];
      const version = versions[0];
      if (!version) return;

      const raw = await fetchTextCached(
        `${DDRAGON_CDN}/${version}/data/${LOCALIZATION_LOCALE}/championFull.json`,
        `localization/${LOCALIZATION_LOCALE}-${version}-championFull.json`,
        CATALOG_TTL_MS,
      );
      const data = JSON.parse(raw) as DdragonChampionFullResponse;
      const names = new Map<number, string>();
      for (const champion of Object.values(data.data ?? {})) {
        for (const entry of champion.skins ?? []) {
          const id = Number(entry.id);
          if (!Number.isFinite(id) || id <= 0) continue;
          const name = (entry.name ?? "").trim();
          if (!name || name.toLowerCase() === "default") continue;
          names.set(id, name);
        }
      }
      if (names.size === 0) return;

      for (const skin of skins) {
        const localized = names.get(skin.id);
        if (localized) skin.name = localized;
        for (const chroma of skin.chromas) {
          const chromaName = names.get(chroma.id);
          if (chromaName) chroma.name = chromaName;
        }
      }
    } catch {
      return;
    }
  }

  private async fetchMasterCatalog(): Promise<{
    skins: Skin[];
    champions: ChampionSummary[];
  }> {
    this.setProgress("catalog", "fetching-catalog", 0, 0, "Şampiyon listesi alınıyor...");
    let summaries: CommunityDragonChampionSummary[] = [];
    try {
      const raw = await fetchTextCached(
        `${this.assetBase}/v1/champion-summary.json`,
        `catalog/${this.catalogScope()}/champion-summary.json`,
        CATALOG_TTL_MS,
      );
      const parsed = JSON.parse(raw);
      summaries = Array.isArray(parsed)
        ? (parsed as CommunityDragonChampionSummary[])
        : [];
    } catch {
      summaries = [];
    }

    const champions: ChampionSummary[] = summaries
      .filter((c) => c.id > 0 && c.name)
      .map((c) => ({
        id: c.id,
        key: String(c.id),
        name: c.name,
        title: c.title ?? "",
        iconUrl: this.championIconUrl(c.id),
        skinCount: 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "en"));

    this.setProgress("catalog", "fetching-catalog", 0, 0, "Kostüm kataloğu alınıyor...");
    let catalog: CommunityDragonSkinsResponse = {};
    try {
      const raw = await fetchTextCached(
        `${this.assetBase}/v1/skins.json`,
        `catalog/${this.catalogScope()}/skins.json`,
        CATALOG_TTL_MS,
      );
      const parsed = JSON.parse(raw);
      catalog =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as CommunityDragonSkinsResponse)
          : {};
    } catch {
      catalog = {};
    }

    const champNameById = new Map<number, string>();
    for (const c of champions) champNameById.set(c.id, c.name);

    const skins: Skin[] = [];
    const entries = Object.values(catalog);
    for (const entry of entries) {
      const skin = this.mapCatalogSkin(entry, champNameById);
      if (skin) skins.push(skin);
    }

    return { skins, champions };
  }

  private mapCatalogSkin(
    entry: CommunityDragonSkin,
    champNameById: Map<number, string>,
  ): Skin | null {
    if (!entry || typeof entry.id !== "number") return null;
    const championId = Math.floor(entry.id / 1000);
    const skinNum = entry.id % 1000;
    const championName = champNameById.get(championId) ?? `Şampiyon ${championId}`;

    const chromas: Chroma[] = (entry.chromas ?? []).map((ch) => {
      const colors = (ch.colors ?? []).map((c) => this.normalizeColor(c));
      return {
        id: ch.id,
        name: ch.name,
        color: colors[0] ?? "#c8aa6e",
        colors,
        imageUrl: this.assetUrl(ch.chromaPath),
        owned: false,
        packageUrl: null,
      };
    });

    const splash = entry.uncenteredSplashPath || entry.splashPath;

    return {
      id: entry.id,
      championId,
      championName,
      skinNum,
      name: entry.name && entry.name.trim() ? entry.name : `Kostüm ${skinNum}`,
      description: entry.description ?? "",
      rarity: entry.rarity ?? "kNoRarity",
      isLegacy: entry.isLegacy ?? false,
      isBase: entry.isBase ?? false,
      chromas,
      splashUrl: this.assetUrl(splash),
      tileUrl: this.assetUrl(entry.tilePath),
      loadScreenUrl: this.assetUrl(entry.loadScreenPath),
      favorite: false,
      ready: false,
      packageUrl: null,
      sources: [],
    };
  }

  private normalizeColor(value: string): string {
    if (!value) return "#c8aa6e";
    let hex = value.trim().toLowerCase();
    if (hex.startsWith("#")) hex = hex.slice(1);
    if (/^[0-9a-f]{8}$/.test(hex)) {
      const a = hex.slice(0, 2);
      const r = hex.slice(2, 4);
      const g = hex.slice(4, 6);
      const b = hex.slice(6, 8);
      if (a === "ff") return `#${r}${g}${b}`;
      return `#${r}${g}${b}`;
    }
    if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`;
    return "#c8aa6e";
  }

  private async applyRepository(
    repo: RepositoryConfig,
    byId: Map<number, Skin>,
    championNameToId: Map<string, number>,
  ): Promise<void> {
    try {
      switch (repo.id) {
        case "bettie9":
          await this.applyBettie9(repo, byId, championNameToId);
          break;
        case "alban1911":
          await this.applyTree(repo, byId, "alban1911");
          break;
        case "darkseal":
          await this.applyTree(repo, byId, "darkseal");
          break;
      }
    } catch (err) {
      this.setProgress(
        repo.id,
        "error",
        0,
        0,
        `${repo.label}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private attachPackage(
    skin: Skin,
    repo: RepositoryConfig,
    packagePath: string,
    source: SkinSourceType,
  ): void {
    const url = repo.archiveUrlTemplate.replace(
      "{path}",
      encodeRepoPath(packagePath),
    );
    if (!skin.sources.includes(source)) skin.sources.push(source);
    const key = this.rankKey("s", skin.id);
    const current = this.packageRank.get(key);
    if (!skin.packageUrl || current === undefined || repo.weight < current) {
      skin.packageUrl = url;
      this.packageRank.set(key, repo.weight);
    }
  }

  private attachChromaPackage(
    chroma: Chroma,
    repo: RepositoryConfig,
    packagePath: string,
  ): void {
    const key = this.rankKey("c", chroma.id);
    const current = this.packageRank.get(key);
    if (!chroma.packageUrl || current === undefined || repo.weight < current) {
      chroma.packageUrl = repo.archiveUrlTemplate.replace(
        "{path}",
        encodeRepoPath(packagePath),
      );
      this.packageRank.set(key, repo.weight);
    }
  }

  private async applyBettie9(
    repo: RepositoryConfig,
    byId: Map<number, Skin>,
    championNameToId: Map<string, number>,
  ): Promise<void> {
    this.setProgress(repo.id, "fetching-index", 0, 0, "index.json alınıyor...");
    const raw = await fetchTextCached(repo.indexUrl, "catalog/bettie9-index.json", 3600_000);
    const index = JSON.parse(raw) as Bettie9Index;
    const champions = index.champions ?? {};
    const total = Object.keys(champions).length;
    let processed = 0;

    for (const [champName, data] of Object.entries(champions)) {
      const champKey = this.normalizeName(champName);
      const champId =
        championNameToId.get(champKey) ??
        championNameToId.get(CHAMPION_KEY_ALIASES[champKey] ?? "") ??
        championNameToId.get(champKey.replace(/^mnt/gi, ""));
      if (champId) {
        for (const [numStr, skinName] of Object.entries(data.skins ?? {})) {
          const num = Number(numStr);
          if (!Number.isFinite(num)) continue;
          const skinId = champId * 1000 + num;
          const target = byId.get(skinId);
          if (target) this.attachPackage(target, repo, `${champName}/${skinName}.fantome`, "bettie9");
        }
        for (const [skinNum, chromas] of Object.entries(data.chromas ?? {})) {
          const num = Number(skinNum);
          if (!Number.isFinite(num)) continue;
          const skinId = champId * 1000 + num;
          const target = byId.get(skinId);
          if (!target) continue;
          for (const [chromaIdStr, chromaName] of Object.entries(chromas)) {
            const chromaId = Number(chromaIdStr);
            const chroma = target.chromas.find((c) => c.id === chromaId);
            if (chroma) {
              this.attachChromaPackage(
                chroma,
                repo,
                `${champName}/${skinNum}/${chromaName}.fantome`,
              );
            }
          }
          if (!target.sources.includes("bettie9")) target.sources.push("bettie9");
        }
      }
      processed += 1;
      if (processed % 25 === 0) {
        this.setProgress(repo.id, "parsing", processed, total, `Eşleniyor ${processed}/${total}`);
      }
    }

    this.setProgress(repo.id, "complete", total, total, `${total} şampiyon eşlendi`);
  }

  private async applyTree(
    repo: RepositoryConfig,
    byId: Map<number, Skin>,
    source: SkinSourceType,
  ): Promise<void> {
    this.setProgress(repo.id, "fetching-index", 0, 0, "GitHub ağacı alınıyor...");
    const raw = await fetchTextCached(repo.indexUrl, `catalog/${repo.id}-tree.json`, 3600_000);
    const tree = JSON.parse(raw) as GithubTreeResponse;
    const blobs = tree.tree.filter(
      (e) => e.type === "blob" && /\.(fantome|zip|modpkg)$/i.test(e.path),
    );
    const total = blobs.length;

    for (let i = 0; i < total; i++) {
      const path = blobs[i].path.replace(/\\/g, "/");
      if (source === "alban1911") {
        const match = path.match(/skins\/(\d+)\/(\d+)\/(\d+)\.fantome$/i);
        if (match) {
          const skinId = Number(match[3]);
          const target = byId.get(skinId);
          if (target) this.attachPackage(target, repo, path, source);
        }
      } else {
        const match = path.match(/^skins\/([^/]+)\/([^/]+)\.zip$/i);
        if (match) {
          const champName = match[1];
          const skinName = match[2];
          const target = this.findSkinByName(byId, champName, skinName);
          if (target) this.attachPackage(target, repo, path, source);
        } else {
          const chromaMatch = path.match(
            /^skins\/([^/]+)\/chromas\/([^/]+)\/([^/]+)\.zip$/i,
          );
          if (chromaMatch) {
            this.attachDarksealChroma(
              byId,
              repo,
              chromaMatch[1],
              chromaMatch[2],
              chromaMatch[3],
              path,
              source,
            );
          }
        }
      }
      if (i % 200 === 0) {
        this.setProgress(repo.id, "parsing", i, total, `Eşleniyor ${i}/${total}`);
      }
    }

    this.setProgress(repo.id, "complete", total, total, `${total} arşiv tarandı`);
  }

  private attachDarksealChroma(
    byId: Map<number, Skin>,
    repo: RepositoryConfig,
    champName: string,
    chromaLabel: string,
    fileBase: string,
    path: string,
    source: SkinSourceType,
  ): void {
    const champKey = this.normalizeName(champName);
    const labelKey = this.normalizeName(chromaLabel);
    const idMatch = fileBase.match(/(\d+)\s*$/);
    const chromaId = idMatch ? Number(idMatch[1]) : NaN;

    if (Number.isFinite(chromaId) && chromaId > 0) {
      for (const skin of byId.values()) {
        if (this.normalizeName(skin.championName) !== champKey) continue;
        const chroma = skin.chromas.find((c) => c.id === chromaId);
        if (chroma) {
          this.attachChromaPackage(chroma, repo, path);
          if (!skin.sources.includes(source)) skin.sources.push(source);
          return;
        }
      }
    }

    const target = this.findSkinByName(byId, champName, chromaLabel);
    if (!target) return;
    const chroma = target.chromas.find(
      (c) => this.normalizeName(c.name) === labelKey,
    );
    if (chroma) this.attachChromaPackage(chroma, repo, path);
    if (!target.sources.includes(source)) target.sources.push(source);
  }

  private findSkinByName(
    byId: Map<number, Skin>,
    champName: string,
    skinName: string,
  ): Skin | null {
    const champKey = this.normalizeName(champName);
    const fullKey = this.normalizeName(skinName);
    const strippedKey = this.normalizeName(skinName.replace(/\s+\d+$/, ""));
    if (!fullKey) return null;

    let partial: Skin | null = null;
    for (const skin of byId.values()) {
      if (this.normalizeName(skin.championName) !== champKey) continue;
      const skinNorm = this.normalizeName(skin.name);
      if (skinNorm === fullKey) return skin;
      if (
        strippedKey &&
        strippedKey !== fullKey &&
        skinNorm === strippedKey &&
        !partial
      ) {
        partial = skin;
      }
    }
    if (partial) return partial;
    if (!strippedKey || strippedKey === fullKey) return null;

    for (const skin of byId.values()) {
      if (this.normalizeName(skin.championName) !== champKey) continue;
      if (this.normalizeName(skin.name).includes(strippedKey)) return skin;
    }
    return null;
  }
}
