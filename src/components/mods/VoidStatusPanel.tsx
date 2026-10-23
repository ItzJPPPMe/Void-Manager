import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import clsx from "clsx";
import { useAppStore } from "@/store/appStore";
import {
  voidModsHealth,
  voidOverlayStatus,
  type ModHealth,
  type OverlayStatus,
} from "@/services/voidEngine";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatTime(ms: number | null): string {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleString("tr-TR");
  } catch {
    return "—";
  }
}

export function VoidStatusPanel() {
  const showToast = useAppStore((s) => s.showToast);
  const [overlay, setOverlay] = useState<OverlayStatus | null>(null);
  const [health, setHealth] = useState<ModHealth[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [status, mods] = await Promise.all([
        voidOverlayStatus(),
        voidModsHealth(),
      ]);
      setOverlay(status);
      setHealth(mods);
    } catch (err) {
      showToast(
        typeof err === "string" ? err : "VOID durumu okunamadı",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 20000);
    return () => clearInterval(timer);
  }, [load]);

  const unhealthy = health.filter((mod) => !mod.healthy);

  return (
    <div className="mb-4 grid gap-3 lg:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-neon-cyan" />
            <h3 className="font-display text-sm font-semibold uppercase tracking-wide">
              Overlay Durumu
            </h3>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="btn-ghost !px-2 !py-1"
            title="Yenile"
          >
            <RefreshCw
              className={clsx("h-3.5 w-3.5", loading && "animate-spin")}
            />
          </button>
        </div>

        {overlay ? (
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Durum</span>
              {overlay.exists ? (
                overlay.stale ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-400">
                    <AlertTriangle className="h-3 w-3" /> Eskimiş
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-neon-lime">
                    <CheckCircle2 className="h-3 w-3" /> Güncel
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-1 font-semibold text-slate-400">
                  <AlertTriangle className="h-3 w-3" /> Derlenmedi
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Dosya / boyut</span>
              <span className="font-mono text-slate-200">
                {overlay.fileCount} · {formatBytes(overlay.totalBytes)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Etkin mod</span>
              <span className="font-mono text-slate-200">
                {overlay.enabledMods}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Son derleme</span>
              <span className="text-slate-300">
                {formatTime(overlay.lastBuiltMs)}
              </span>
            </div>
            <p
              className="truncate pt-1 text-[10px] text-slate-600"
              title={overlay.overlayDir}
            >
              {overlay.overlayDir}
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Yükleniyor...</p>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-neon-lime" />
            <h3 className="font-display text-sm font-semibold uppercase tracking-wide">
              Mod Sağlığı
            </h3>
          </div>
          <span className="font-mono text-[11px] text-slate-400">
            {health.length - unhealthy.length}/{health.length} sağlıklı
          </span>
        </div>

        {health.length === 0 ? (
          <p className="text-xs text-slate-500">Henüz VOID modu yok.</p>
        ) : unhealthy.length === 0 ? (
          <p className="inline-flex items-center gap-1.5 text-xs text-neon-lime">
            <CheckCircle2 className="h-3.5 w-3.5" /> Tüm modlar sorunsuz.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {unhealthy.slice(0, 6).map((mod) => (
              <li
                key={mod.id}
                className="rounded-lg border border-amber-400/20 bg-amber-500/5 px-2.5 py-1.5"
              >
                <p className="truncate text-xs font-semibold text-amber-200">
                  {mod.name}
                </p>
                <p className="text-[10px] text-amber-400/80">
                  {mod.issues.join(" · ")}
                </p>
              </li>
            ))}
            {unhealthy.length > 6 && (
              <li className="text-[10px] text-slate-500">
                +{unhealthy.length - 6} mod daha
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
