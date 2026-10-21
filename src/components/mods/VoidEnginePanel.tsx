import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import clsx from "clsx";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Layers,
  Package,
  Play,
  RefreshCw,
  Square,
  Terminal,
  Trash2,
  Upload,
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import {
  voidModsBuildOverlay,
  voidModsImport,
  voidModsList,
  voidModsPaths,
  voidModsRemove,
  voidModsSetEnabled,
  voidPatcherConfig,
  voidPatcherLogs,
  voidPatcherStart,
  voidPatcherStatus,
  voidPatcherStop,
  type OverlayProgress,
  type PatcherConfig,
  type PatcherEvent,
  type PatcherStatus,
  type VoidMod,
  type VoidModsPaths,
} from "@/services/voidEngine";

const STAGE_LABELS: Record<string, string> = {
  Indexing: "Oyun dizini taranıyor",
  IndexingObjects: "Nesneler dizinleniyor",
  CollectingOverrides: "Mod dosyaları okunuyor",
  PatchingWad: "WAD yamalanıyor",
  ApplyingStringOverrides: "Metin geçersiz kılmaları uygulanıyor",
  Complete: "Tamamlandı",
};

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      disabled={disabled}
      className={clsx(
        "relative h-5 w-9 shrink-0 rounded-full transition",
        checked ? "bg-neon-violet/80" : "bg-white/10",
        disabled && "opacity-40",
      )}
    >
      <span
        className={clsx(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
          checked ? "left-4" : "left-0.5",
        )}
      />
    </button>
  );
}

export function VoidEnginePanel() {
  const showToast = useAppStore((s) => s.showToast);
  const [paths, setPaths] = useState<VoidModsPaths | null>(null);
  const [mods, setMods] = useState<VoidMod[]>([]);
  const [patcher, setPatcher] = useState<PatcherStatus | null>(null);
  const [config, setConfig] = useState<PatcherConfig | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState<OverlayProgress | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [logLevel, setLogLevel] = useState(0x10);
  const [flags, setFlags] = useState(4);

  const refresh = useCallback(async () => {
    try {
      const [nextPaths, nextMods, nextPatcher, nextConfig] = await Promise.all([
        voidModsPaths(),
        voidModsList(),
        voidPatcherStatus(),
        voidPatcherConfig(),
      ]);
      setPaths(nextPaths);
      setMods(nextMods);
      setPatcher(nextPatcher);
      setConfig(nextConfig);
      setFlags((current) => current || nextConfig.defaultFlags);
    } catch (e) {
      showToast(typeof e === "string" ? e : "Motor durumu okunamadı", "error");
    }
  }, [showToast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const attach = async () => {
      const offPatch = await listen<PatcherEvent>("void-patcher-event", (event) => {
        const payload = event.payload;
        setLogs((prev) => [...prev.slice(-199), payload.message]);
        setPatcher((prev) =>
          prev
            ? {
                ...prev,
                state: payload.state ?? prev.state,
                lastMessage: payload.message,
                running: payload.state === "waiting" || payload.state === "injected",
              }
            : prev,
        );
      });
      const offProgress = await listen<OverlayProgress>(
        "void-overlay-progress",
        (event) => setProgress(event.payload),
      );
      unlisten = () => {
        offPatch();
        offProgress();
      };
    };
    void attach();
    return () => unlisten?.();
  }, []);

  const handleImport = async () => {
    try {
      const picked = await open({
        multiple: false,
        title: "Mod paketi seç (.modpkg / .fantome)",
        filters: [{ name: "Mod paketleri", extensions: ["modpkg", "fantome"] }],
      });
      if (!picked || Array.isArray(picked)) return;
      setBusy("import");
      const mod = await voidModsImport(picked);
      showToast(`${mod.name} kütüphaneye eklendi`, "success");
      await refresh();
    } catch (e) {
      showToast(typeof e === "string" ? e : "Paket içe aktarılamadı", "error");
    } finally {
      setBusy(null);
    }
  };

  const handleToggle = async (mod: VoidMod, value: boolean) => {
    setBusy(mod.id);
    try {
      setMods(await voidModsSetEnabled(mod.id, value));
    } catch (e) {
      showToast(typeof e === "string" ? e : "Mod durumu güncellenemedi", "error");
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async (mod: VoidMod) => {
    setBusy(mod.id);
    try {
      setMods(await voidModsRemove(mod.id));
      showToast(`${mod.name} kaldırıldı`, "success");
    } catch (e) {
      showToast(typeof e === "string" ? e : "Mod kaldırılamadı", "error");
    } finally {
      setBusy(null);
    }
  };

  const handleBuild = async () => {
    setBusy("build");
    setProgress(null);
    try {
      const summary = await voidModsBuildOverlay();
      showToast(
        `Overlay hazır: ${summary.built.length} WAD yazıldı, ${summary.reused.length} yeniden kullanıldı (${summary.buildTimeMs} ms)`,
        "success",
      );
    } catch (e) {
      showToast(typeof e === "string" ? e : "Overlay derlenemedi", "error");
    } finally {
      setBusy(null);
    }
  };

  const handlePatcherStart = async () => {
    setBusy("patcher");
    try {
      const next = await voidPatcherStart(undefined, logLevel, flags);
      setPatcher(next);
      showToast("Patcher başlatıldı, oyun aranıyor...", "success");
    } catch (e) {
      showToast(typeof e === "string" ? e : "Patcher başlatılamadı", "error");
    } finally {
      setBusy(null);
    }
  };

  const handlePatcherStop = async () => {
    setBusy("patcher");
    try {
      await voidPatcherStop();
      setLogs(await voidPatcherLogs());
      setPatcher(await voidPatcherStatus());
      showToast("Patcher durduruldu", "info");
    } catch (e) {
      showToast(typeof e === "string" ? e : "Patcher durdurulamadı", "error");
    } finally {
      setBusy(null);
    }
  };

  const enabledCount = mods.filter((m) => m.enabled).length;
  const building = busy === "build";
  const stageText = progress
    ? (STAGE_LABELS[progress.stage] ?? progress.stage)
    : null;

  return (
    <div className="mb-5 rounded-2xl border border-neon-cyan/25 bg-void-800/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-1 flex items-center gap-2">
          <Activity className="h-4 w-4 text-neon-cyan" />
          <h3 className="font-display text-sm font-bold uppercase tracking-widest text-neon-cyan/90">
            VOID Yama Motoru
          </h3>
        </div>
        <span className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] font-mono text-slate-400">
          {mods.length} mod · {enabledCount} etkin
        </span>
        <button
          onClick={() => void refresh()}
          className="btn-ghost ml-auto !py-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Yenile
        </button>
        <button
          onClick={() => void handleImport()}
          disabled={busy !== null}
          className="btn-ghost !py-1.5"
        >
          <Upload className="h-3.5 w-3.5 text-neon-cyan" />
          Paket Ekle
        </button>
        <button
          onClick={() => void handleBuild()}
          disabled={busy !== null || enabledCount === 0}
          className="btn-primary !py-1.5"
        >
          <Layers className={clsx("h-3.5 w-3.5", building && "animate-pulse")} />
          Overlay Derle
        </button>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        LTK Manager'a ihtiyaç duymadan, VOID'un kendi motoru paketleri açar ve
        yamalanmış WAD dosyalarını kendi overlay klasörüne üretir.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-3">
        <div className="rounded-lg bg-void-900/50 px-3 py-2">
          <p className="flex items-center gap-1 text-slate-500">
            <Cpu className="h-3 w-3" /> Oyun dizini
          </p>
          <p className="mt-0.5 truncate font-mono text-slate-300">
            {paths?.gameDir ?? "bulunamadı"}
          </p>
        </div>
        <div className="rounded-lg bg-void-900/50 px-3 py-2">
          <p className="flex items-center gap-1 text-slate-500">
            <Layers className="h-3 w-3" /> Overlay
          </p>
          <p className="mt-0.5 truncate font-mono text-slate-300">
            {paths?.overlayDir ?? "—"}
          </p>
        </div>
        <div className="rounded-lg bg-void-900/50 px-3 py-2">
          <p className="flex items-center gap-1 text-slate-500">
            <Terminal className="h-3 w-3" /> Patcher
          </p>
          <p
            className={clsx(
              "mt-0.5 truncate font-mono",
              patcher?.available ? "text-neon-lime" : "text-rose-300",
            )}
          >
            {patcher?.available ? "binary bulundu" : "binary yok"}
          </p>
        </div>
      </div>

      {stageText && (
        <div className="mt-3 rounded-lg border border-neon-cyan/25 bg-neon-cyan/5 px-3 py-2">
          <p className="text-[11px] font-semibold text-neon-cyan">{stageText}</p>
          {progress && progress.total > 0 && (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-neon-cyan/70 transition-all"
                style={{
                  width: `${Math.min(100, (progress.current / progress.total) * 100)}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {mods.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {mods.map((mod) => (
            <div
              key={mod.id}
              className="flex items-center gap-3 rounded-lg bg-void-900/50 px-3 py-2"
            >
              <Package className="h-4 w-4 shrink-0 text-neon-violet" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-200">
                  {mod.name}
                </p>
                <p className="truncate text-[10px] text-slate-500">
                  .{mod.source}
                  {mod.version ? ` · v${mod.version}` : ""}
                  {mod.champions.length > 0
                    ? ` · ${mod.champions.join(", ")}`
                    : ""}
                </p>
              </div>
              <button
                onClick={() => void handleRemove(mod)}
                disabled={busy !== null}
                className="rounded-md p-1.5 text-slate-500 transition hover:bg-rose-500/15 hover:text-rose-300"
                aria-label="Modu kaldır"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <Toggle
                checked={mod.enabled}
                onChange={(value) => void handleToggle(mod, value)}
                disabled={busy !== null}
              />
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
        {config && (
          <select
            value={logLevel}
            onChange={(e) => setLogLevel(Number(e.target.value))}
            className="rounded-lg border border-white/10 bg-void-900 px-2.5 py-1.5 text-[11px] text-slate-300 outline-none"
          >
            {config.logLevels.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        )}
        {config?.hookFlags.map((flag) => (
          <label
            key={flag.value}
            title={flag.description}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-void-900/50 px-2.5 py-1.5 text-[11px] text-slate-400"
          >
            <input
              type="checkbox"
              checked={(flags & flag.value) !== 0}
              onChange={(e) =>
                setFlags((current) =>
                  e.target.checked ? current | flag.value : current & ~flag.value,
                )
              }
              className="accent-neon-cyan"
            />
            {flag.label}
          </label>
        ))}
        {patcher?.running ? (
          <button
            onClick={() => void handlePatcherStop()}
            disabled={busy !== null}
            className="btn-ghost ml-auto !py-1.5"
          >
            <Square className="h-3.5 w-3.5" />
            Patcher'ı Durdur
          </button>
        ) : (
          <button
            onClick={() => void handlePatcherStart()}
            disabled={busy !== null || !patcher?.available}
            className="btn-primary ml-auto !py-1.5"
          >
            <Play className="h-3.5 w-3.5" />
            Yamayı Başlat
          </button>
        )}
      </div>

      {!patcher?.available && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-300/80">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          Patcher için ltk_patcher_host.exe ve ltk_patcher_dll.dll dosyalarını
          uygulamanın yanındaki "patcher" klasörüne ya da %LOCALAPPDATA%\VOID\patcher
          içine kopyalayın. Overlay derlemesi bu dosyalar olmadan da çalışır.
        </p>
      )}

      {patcher?.running && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-neon-lime">
          <CheckCircle2 className="h-3 w-3" />
          Patcher {patcher.state} — {patcher.lastMessage}
        </p>
      )}

      {logs.length > 0 && (
        <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-black/40 p-2.5 font-mono text-[10px] leading-relaxed text-slate-400">
          {logs.map((line, index) => (
            <p key={`${index}-${line}`} className="break-all">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
