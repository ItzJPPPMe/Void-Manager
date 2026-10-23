import { useEffect, useRef } from "react";
import { lcuStatus } from "@/services/ltkManager";
import {
  voidModsBuildOverlay,
  voidOverlayStatus,
  voidPatcherStart,
  voidPatcherStatus,
} from "@/services/voidEngine";
import { useAppStore } from "@/store/appStore";

export function useAutoPatch(enabled: boolean) {
  const showToast = useAppStore((s) => s.showToast);
  const wasRunning = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const lcu = await lcuStatus();
        if (cancelled) return;
        if (!lcu.running) {
          wasRunning.current = false;
          return;
        }
        if (wasRunning.current) return;
        wasRunning.current = true;

        const status = await voidPatcherStatus();
        if (cancelled || status.running) return;

        try {
          const overlay = await voidOverlayStatus();
          if (overlay.stale && overlay.enabledMods > 0) {
            showToast("Overlay güncelleniyor...", "info");
            await voidModsBuildOverlay();
          }
          await voidPatcherStart();
          showToast("Oyun algılandı, VOID Patcher başlatıldı", "success");
        } catch (err) {
          showToast(
            typeof err === "string" ? err : "VOID Patcher başlatılamadı",
            "error",
          );
        }
      } catch {
        wasRunning.current = false;
      }
    };

    void tick();
    const timer = setInterval(tick, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, showToast]);
}
