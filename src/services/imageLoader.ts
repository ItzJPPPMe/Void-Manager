import {
  cacheResolve,
  clearImageCache,
  downloadToCache,
  toAssetUrl,
} from "./ltkManager";
import { useSettingsStore } from "@/store/settingsStore";

const CACHE_ROOT = "images";

function djb2(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function extFromUrl(url: string): string {
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".png")) return "png";
  if (clean.endsWith(".webp")) return "webp";
  return "jpg";
}

function cacheKeyFor(url: string): string {
  return `${CACHE_ROOT}/${djb2(url)}.${extFromUrl(url)}`;
}

export interface ImageLoaderOptions {
  enabled?: boolean;
  ttlHours?: number;
}

export class ImageLoader {
  private urlMap = new Map<string, string>();
  private inflight = new Map<string, Promise<string | null>>();
  private queue: (() => void)[] = [];
  private active = 0;
  private maxConcurrent = 10;
  private enabled = true;
  private ttlHours = 336;
  private static readonly MAX_ENTRIES = 4000;

  constructor(opts: ImageLoaderOptions) {
    this.configure(opts);
  }

  configure(opts: ImageLoaderOptions): void {
    if (opts.enabled !== undefined) this.enabled = opts.enabled;
    if (opts.ttlHours !== undefined && Number.isFinite(opts.ttlHours)) {
      this.ttlHours = Math.max(1, opts.ttlHours);
    }
  }

  private ttlMs(): number {
    return Math.round(this.ttlHours * 60 * 60 * 1000);
  }

  private pump(): void {
    while (this.active < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;
      this.active += 1;
      task();
    }
  }

  private schedule<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            this.active -= 1;
            this.pump();
          });
      };
      this.queue.push(run);
      this.pump();
    });
  }

  async resolve(url: string): Promise<string | null> {
    if (!url) return null;
    const known = this.urlMap.get(url);
    if (known) return known;

    const pending = this.inflight.get(url);
    if (pending) return pending;

    const key = cacheKeyFor(url);

    const task = this.schedule(async () => {
      try {
        const ttlMs = this.ttlMs();
        if (this.enabled) {
          const existing = await cacheResolve(key, ttlMs);
          if (existing) {
            const asset = toAssetUrl(existing);
            this.remember(url, asset);
            return asset;
          }
        }
        const full = await downloadToCache(url, key, ttlMs, this.enabled);
        const asset = toAssetUrl(full);
        this.remember(url, asset);
        return asset;
      } catch {
        return null;
      }
    });

    this.inflight.set(url, task);
    try {
      return await task;
    } finally {
      this.inflight.delete(url);
    }
  }

  private remember(url: string, asset: string): void {
    if (this.urlMap.size >= ImageLoader.MAX_ENTRIES) {
      const first = this.urlMap.keys().next().value;
      if (first !== undefined) this.urlMap.delete(first);
    }
    this.urlMap.set(url, asset);
  }

  async clearCache(): Promise<number> {
    this.urlMap.clear();
    return clearImageCache();
  }
}

let singleton: ImageLoader | null = null;

export function getImageLoader(): ImageLoader {
  if (!singleton) {
    const settings = useSettingsStore.getState().settings;
    singleton = new ImageLoader({
      enabled: settings.imageCacheEnabled,
      ttlHours: settings.imageCacheTtlHours,
    });
  }
  return singleton;
}
