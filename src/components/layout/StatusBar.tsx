import { Database, HardDrive, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { useAppStore } from "@/store/appStore";
import { useChampionStore } from "@/store/championStore";
import { useRepositories } from "@/hooks/useRepositories";
import { useSettingsStore } from "@/store/settingsStore";

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px]">
      <span
        className={clsx(
          "h-2 w-2 rounded-full",
          ok
            ? "animate-pulseGlow bg-neon-lime shadow-[0_0_8px_rgba(163,255,18,0.8)]"
            : "bg-rose-500",
        )}
      />
      <span className={ok ? "text-slate-300" : "text-rose-400"}>{label}</span>
    </span>
  );
}

export function StatusBar() {
  const systemStatus = useAppStore((s) => s.systemStatus);
  const ltkStatus = useAppStore((s) => s.ltkStatus);
  const skins = useChampionStore((s) => s.skins);
  const loading = useChampionStore((s) => s.loading);
  const catalogSource = useChampionStore((s) => s.catalogSource);
  const syncProgressText = useChampionStore((s) => s.syncProgressText);
  const lastSyncedAt = useSettingsStore((s) => s.sync.lastSyncedAt);
  const { sync } = useRepositories();

  return (
    <footer className="relative z-10 flex h-10 shrink-0 items-center justify-between border-t border-white/5 bg-void-900/90 px-4 text-slate-400 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <StatusDot
          ok={Boolean(systemStatus?.leagueReady)}
          label={
            systemStatus?.leagueReady ? "League hazır" : "League bulunamadı"
          }
        />
        <StatusDot
          ok={Boolean(ltkStatus?.found)}
          label={ltkStatus?.found ? "LTK Manager hazır" : "LTK Manager yok"}
        />
        {ltkStatus?.found && (
          <StatusDot
            ok={Boolean(ltkStatus.patcherRunning)}
            label={
              ltkStatus.patcherRunning
                ? "Patcher çalışıyor"
                : "Patcher çalışmıyor"
            }
          />
        )}
        <StatusDot
          ok={Boolean(systemStatus?.riotClientReady)}
          label={
            systemStatus?.riotClientReady
              ? "Riot Client hazır"
              : "Riot Client yok"
          }
        />
      </div>

      <div className="flex items-center gap-4 font-mono text-[11px]">
        {syncProgressText && (
          <span className="animate-pulseGlow text-neon-cyan">
            {syncProgressText}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Database className="h-3 w-3" /> {skins.length} kostüm
        </span>
        {catalogSource && (
          <span
            className={clsx(
              "inline-flex items-center gap-1 rounded px-1.5 py-0.5",
              catalogSource === "lcu"
                ? "bg-neon-lime/15 text-neon-lime"
                : "bg-neon-cyan/15 text-neon-cyan",
            )}
          >
            {catalogSource === "lcu" ? "Yerel (LCU)" : "Çevrimiçi"}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <HardDrive className="h-3 w-3" />
          {systemStatus?.cacheSizeMb?.toFixed(1) ?? "0"} MB cache
        </span>
        {lastSyncedAt && (
          <span>
            Son senkron: {new Date(lastSyncedAt).toLocaleTimeString("tr-TR")}
          </span>
        )}
        <button
          onClick={() => void sync()}
          disabled={loading}
          className="btn-ghost !px-2 !py-0.5 !text-[11px]"
        >
          <RefreshCw className={clsx("h-3 w-3", loading && "animate-spin")} />
          Senkronize et
        </button>
      </div>
    </footer>
  );
}
