import { useCallback, useEffect, useRef, useState } from "react";
import { SyncService } from "@/services/syncService";
import { useChampionStore } from "@/store/championStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useAppStore } from "@/store/appStore";
import type { SyncProgress } from "@/types/settings";

export function useRepositories() {
  const settings = useSettingsStore((s) => s.settings);
  const running = useSettingsStore((s) => s.sync.running);
  const setSyncState = useSettingsStore((s) => s.setSyncState);
  const setSkins = useChampionStore((s) => s.setSkins);
  const setChampions = useChampionStore((s) => s.setChampions);
  const setCatalogSource = useChampionStore((s) => s.setCatalogSource);
  const setLoading = useChampionStore((s) => s.setLoading);
  const setSyncProgressText = useChampionStore((s) => s.setSyncProgressText);
  const showToast = useAppStore((s) => s.showToast);
  const serviceRef = useRef<SyncService | null>(null);
  const [progress, setProgress] = useState<SyncProgress[]>([]);

  if (!serviceRef.current) {
    serviceRef.current = new SyncService(settings);
  }

  useEffect(() => {
    serviceRef.current?.updateSettings(settings);
  }, [settings]);

  const sync = useCallback(async () => {
    const service = serviceRef.current;
    if (!service) return;
    if (useSettingsStore.getState().sync.running) return;
    setLoading(true);
    setSyncState({ running: true, errors: [] });
    const unsubscribe = service.onProgress((p) => {
      setProgress(p);
      const activeEntry = p.find(
        (x) => x.phase !== "complete" && x.phase !== "error" && x.message,
      );
      setSyncProgressText(activeEntry ? activeEntry.message : null);
    });
    try {
      const { skins, champions, source, errors, reusedRepos, changedRepos } =
        await service.syncAll();
      setSkins(skins);
      setChampions(champions);
      setCatalogSource(source);
      setSyncState({ running: false, lastSyncedAt: Date.now(), errors });
      const label = source === "lcu" ? "yerel istemci" : "çevrimiçi";
      const smart =
        reusedRepos.length > 0
          ? ` · ${reusedRepos.length} kaynak önbellekten yeniden kullanıldı`
          : "";
      const changed =
        changedRepos.length > 0
          ? ` · ${changedRepos.length} kaynak güncellendi`
          : "";
      if (errors.length > 0) {
        showToast(
          `${skins.length} kostüm yüklendi (${label}${smart}${changed}), ancak ${errors.length} kaynak başarısız: ${errors[0]}`,
          "error",
        );
      } else if (skins.length === 0) {
        showToast(
          "Senkronizasyon tamamlandı, ancak hiçbir kostüm yüklenemedi",
          "error",
        );
      } else {
        showToast(
          `${skins.length} kostüm yüklendi (${label}${smart}${changed})`,
          "success",
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSyncState({ running: false, errors: [message] });
      showToast(`Senkronizasyon hatası: ${message}`, "error");
    } finally {
      unsubscribe();
      setLoading(false);
      setSyncProgressText(null);
    }
  }, [
    setCatalogSource,
    setChampions,
    setLoading,
    setSkins,
    setSyncState,
    setSyncProgressText,
    showToast,
  ]);

  return { sync, progress, running };
}
