import {
  cacheResolve,
  clearImageCache,
  downloadToCache,
  toAssetUrl,
} from "./ltkManager";

const CACHE_ROOT = "images";

const QUALITY_SUFFIX: Record<string, string> = {
  low: "",
  medium: "",
  high: "",
  ultra: "",
};

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
  quality?: string;
  ttlHours?: number;
}

export class ImageLoader {
  private urlMap = new Map<string, string>();
  private inflight = new Map<string, Promise<string | null>>();
  private queue: (() => void)[] = [];
  private active = 0;
  private maxConcurrent = 10;
  private enabled = true;
  private static readonly MAX_ENTRIES = 4000;

  constructor(opts: ImageLoaderOptions) {
    this.enabled = opts.enabled ?? true;
  }

  configure(opts: ImageLoaderOptions): void {
    if (opts.enabled !== undefined) this.enabled = opts.enabled;
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
        if (this.enabled) {
          const existing = await cacheResolve(key);
          if (existing) {
            const asset = toAssetUrl(existing);
            this.remember(url, asset);
            return asset;
          }
        }
        const full = await downloadToCache(url, key);
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
    try {
      return await clearImageCache();
    } catch {
      return 0;
    }
  }
}

let singleton: ImageLoader | null = null;

export function getImageLoader(): ImageLoader {
  if (!singleton) {
    singleton = new ImageLoader({ enabled: true, quality: QUALITY_SUFFIX.high });
  }
  return singleton;
}
