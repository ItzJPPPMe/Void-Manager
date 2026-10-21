import type { SkinSourceType } from "@/types/champion";

const STORAGE_KEY = "void-sync-cache-v1";

export interface RepoSnapshot {
  fingerprint: string;
  skinPackages: Record<string, string>;
  chromaPackages: Record<string, string>;
}

export interface SyncCache {
  repos: Partial<Record<SkinSourceType, RepoSnapshot>>;
  updatedAt: number;
}

const EMPTY: SyncCache = { repos: {}, updatedAt: 0 };

function isRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((v) => typeof v === "string")
  );
}

export function readSyncCache(): SyncCache {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<SyncCache>;
    const repos: SyncCache["repos"] = {};
    for (const [key, value] of Object.entries(parsed.repos ?? {})) {
      const snap = value as RepoSnapshot;
      if (
        snap &&
        typeof snap.fingerprint === "string" &&
        isRecord(snap.skinPackages) &&
        isRecord(snap.chromaPackages)
      ) {
        repos[key as SkinSourceType] = snap;
      }
    }
    return { repos, updatedAt: parsed.updatedAt ?? 0 };
  } catch {
    return { ...EMPTY };
  }
}

export function writeSyncCache(cache: SyncCache): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    return;
  }
}

export function readRepoSnapshot(
  repoId: SkinSourceType,
): RepoSnapshot | null {
  return readSyncCache().repos[repoId] ?? null;
}

export function writeRepoSnapshot(
  repoId: SkinSourceType,
  snapshot: RepoSnapshot,
): void {
  const cache = readSyncCache();
  cache.repos[repoId] = snapshot;
  cache.updatedAt = Date.now();
  writeSyncCache(cache);
}

export function fingerprintOf(value: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + code, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16)}-${h2.toString(16)}`;
}
