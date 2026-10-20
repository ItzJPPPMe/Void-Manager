import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import type { UpdateInfo } from "@/store/appStore";

const REPO = "ItzJPPPMe/Void-Manager";

function parseVersion(value: string): number[] {
  return value
    .replace(/^v/i, "")
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

export function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left > right) return true;
    if (left < right) return false;
  }
  return false;
}

interface GithubRelease {
  tag_name?: string;
  html_url?: string;
  body?: string;
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const current = await getVersion();
  const raw = await invoke<string>("fetch_text_cached", {
    url: `https://api.github.com/repos/${REPO}/releases/latest`,
    cacheKey: "meta/latest-release.json",
    ttlMs: 6 * 60 * 60 * 1000,
  });
  const release = JSON.parse(raw) as GithubRelease;
  const latest = (release.tag_name ?? "").replace(/^v/i, "");
  if (!latest || !isNewer(latest, current)) return null;
  return {
    latest,
    url: release.html_url ?? `https://github.com/${REPO}/releases`,
    notes: release.body ?? "",
  };
}

export async function openReleasePage(url: string): Promise<void> {
  await invoke("open_url", { url });
}
