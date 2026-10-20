import { useCallback, useEffect, useRef, useState } from "react";
import { getImageLoader } from "@/services/imageLoader";
import { useSettingsStore } from "@/store/settingsStore";

export function useImageCache(url: string | null) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  const enabled = useSettingsStore((s) => s.settings.imageCacheEnabled);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!url) {
      setSrc(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    let cancelled = false;
    getImageLoader()
      .resolve(url)
      .then((assetUrl) => {
        if (cancelled || !alive.current) return;
        if (assetUrl) {
          setSrc(assetUrl);
        } else {
          setError("Görsel yüklenemedi");
          setSrc(null);
        }
      })
      .catch((err: unknown) => {
        if (cancelled || !alive.current) return;
        setError(err instanceof Error ? err.message : "Görsel yüklenemedi");
        setSrc(null);
      })
      .finally(() => {
        if (!cancelled && alive.current) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url, enabled]);

  return { src, loading, error };
}

export function useImagePreload(urls: string[]) {
  const key = urls.join("|");
  const run = useCallback(() => {
    const loader = getImageLoader();
    for (const u of urls) {
      if (u) void loader.resolve(u);
    }
  }, [key]);
  useEffect(() => {
    run();
  }, [run]);
}
