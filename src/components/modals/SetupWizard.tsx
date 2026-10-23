import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  FolderOpen,
  RefreshCw,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import clsx from "clsx";
import { useAppStore } from "@/store/appStore";
import { useSettingsStore } from "@/store/settingsStore";
import { openFolder } from "@/services/ltkManager";
import {
  voidDiagnostics,
  voidModsPaths,
  voidPatcherStatus,
  type Diagnostics,
  type PatcherStatus,
  type VoidModsPaths,
} from "@/services/voidEngine";

type Status = "ok" | "warn" | "fail";

interface Check {
  label: string;
  detail: string;
  status: Status;
}

function statusIcon(status: Status) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-neon-lime" />;
  if (status === "warn") return <AlertTriangle className="h-4 w-4 text-amber-400" />;
  return <XCircle className="h-4 w-4 text-rose-400" />;
}

export function SetupWizard() {
  const setSetupOpen = useAppStore((s) => s.setSetupOpen);
  const showToast = useAppStore((s) => s.showToast);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const sendTarget = useSettingsStore((s) => s.settings.sendTarget);
  const setupCompleted = useSettingsStore((s) => s.settings.setupCompleted);
  const update = useSettingsStore((s) => s.update);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [paths, setPaths] = useState<VoidModsPaths | null>(null);
  const [patcher, setPatcher] = useState<PatcherStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [report, resolved, patcherStatus] = await Promise.all([
        voidDiagnostics(),
        voidModsPaths(),
        voidPatcherStatus(),
      ]);
      setDiagnostics(report);
      setPaths(resolved);
      setPatcher(patcherStatus);
    } catch (err) {
      showToast(
        typeof err === "string" ? err : "Tanılama çalıştırılamadı",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const checks: Check[] = diagnostics
    ? [
        {
          label: "League of Legends",
          detail: diagnostics.leagueFound
            ? diagnostics.leaguePath ?? "Bulundu"
            : "Kurulum algılanamadı",
          status: diagnostics.leagueFound ? "ok" : "fail",
        },
        {
          label: "Oyun klasörü (DATA/FINAL)",
          detail: diagnostics.gameDir ?? "Overlay derlemek için gerekli",
          status: diagnostics.gameDir ? "ok" : "fail",
        },
        {
          label: "VOID kök klasörü",
          detail: diagnostics.voidRoot || "—",
          status: diagnostics.voidRoot ? "ok" : "warn",
        },
        {
          label: "Mod kütüphanesi",
          detail: `${diagnostics.modCount} mod, ${diagnostics.enabledCount} etkin`,
          status: diagnostics.brokenMods > 0 ? "warn" : "ok",
        },
        {
          label: "Bozuk modlar",
          detail:
            diagnostics.brokenMods > 0
              ? `${diagnostics.brokenMods} mod klasörü eksik`
              : "Sorun yok",
          status: diagnostics.brokenMods > 0 ? "warn" : "ok",
        },
        {
          label: "Overlay",
          detail: !diagnostics.overlayExists
            ? "Henüz derlenmedi"
            : diagnostics.overlayStale
              ? "Derleme eskimiş, yeniden derle"
              : "Güncel",
          status: !diagnostics.overlayExists
            ? "warn"
            : diagnostics.overlayStale
              ? "warn"
              : "ok",
        },
        {
          label: "Patcher",
          detail: diagnostics.patcherAvailable
            ? diagnostics.patcherPath ?? "Hazır"
            : "Patcher binary'si bulunamadı",
          status: diagnostics.patcherAvailable ? "ok" : "warn",
        },
        {
          label: "Gönderme hedefi",
          detail: sendTarget === "void" ? "VOID Patcher" : "LTK Manager",
          status: "ok",
        },
      ]
    : [];

  const reportText = diagnostics
    ? [
        `VOID Skin Manager ${diagnostics.appVersion}`,
        `League: ${diagnostics.leagueFound ? "OK" : "YOK"} ${diagnostics.leaguePath ?? ""}`,
        `Game dir: ${diagnostics.gameDir ?? "-"}`,
        `VOID root: ${diagnostics.voidRoot}`,
        `Mods: ${diagnostics.modCount} (${diagnostics.enabledCount} etkin, ${diagnostics.brokenMods} bozuk)`,
        `Overlay: ${diagnostics.overlayExists ? "var" : "yok"}${diagnostics.overlayStale ? " (eski)" : ""}`,
        `Patcher: ${diagnostics.patcherAvailable ? diagnostics.patcherPath ?? "var" : "yok"}`,
        `Patcher çalışıyor: ${patcher?.running ? "evet" : "hayır"}`,
        `Hedef: ${sendTarget}`,
      ].join("\n")
    : "";

  const copyReport = async () => {
    if (!reportText) return;
    try {
      await navigator.clipboard.writeText(reportText);
      showToast("Tanılama raporu kopyalandı", "success");
    } catch {
      showToast("Rapor kopyalanamadı", "error");
    }
  };

  const openVoidRoot = async () => {
    const target = paths?.root;
    if (!target) return;
    try {
      await openFolder(target);
    } catch (err) {
      showToast(typeof err === "string" ? err : "Klasör açılamadı", "error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
      onClick={() => setSetupOpen(false)}
    >
      <div
        className="panel flex max-h-[88vh] w-full max-w-2xl animate-slideUp flex-col overflow-hidden !rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-neon-cyan" />
            <h2 className="font-display text-lg font-bold tracking-wide">
              Kurulum ve Tanılama
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => void load()}
              disabled={loading}
              className="btn-ghost !px-2.5"
              title="Yeniden tara"
            >
              <RefreshCw
                className={clsx("h-4 w-4", loading && "animate-spin")}
              />
            </button>
            <button
              onClick={() => setSetupOpen(false)}
              className="btn-ghost !px-2.5"
              aria-label="Kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-3 text-xs leading-relaxed text-slate-400">
            VOID'un oyunda çalışması için gereken bileşenleri kontrol edin.
            Sorunları giderdikten sonra Yeniden tara ile doğrulayın.
          </p>

          <div className="space-y-1.5">
            {checks.map((check) => (
              <div
                key={check.label}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-void-800/50 px-3 py-2.5"
              >
                <span className="mt-0.5">{statusIcon(check.status)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-200">
                    {check.label}
                  </p>
                  <p
                    className="truncate text-[11px] text-slate-500"
                    title={check.detail}
                  >
                    {check.detail}
                  </p>
                </div>
              </div>
            ))}
            {!diagnostics && (
              <p className="py-6 text-center text-xs text-slate-500">
                Taranıyor...
              </p>
            )}
          </div>

          {diagnostics && (
            <div className="mt-4 rounded-xl border border-white/10 bg-void-800/40 p-3">
              <p className="mb-1.5 font-display text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Hızlı işlemler
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void openVoidRoot()}
                  disabled={!paths?.root}
                  className="btn-ghost !py-1.5 !text-[11px] disabled:opacity-40"
                >
                  <FolderOpen className="h-3.5 w-3.5" /> VOID klasörünü aç
                </button>
                <button
                  onClick={() => {
                    setSetupOpen(false);
                    setSettingsOpen(true);
                  }}
                  className="btn-ghost !py-1.5 !text-[11px]"
                >
                  <Wrench className="h-3.5 w-3.5" /> Ayarları aç
                </button>
                <button
                  onClick={() => void copyReport()}
                  className="btn-ghost !py-1.5 !text-[11px]"
                >
                  <Copy className="h-3.5 w-3.5" /> Raporu kopyala
                </button>
                {!setupCompleted && (
                  <button
                    onClick={() => {
                      update({ setupCompleted: true });
                      showToast("Kurulum tamamlandı olarak işaretlendi", "success");
                      setSetupOpen(false);
                    }}
                    className="btn-primary ml-auto !py-1.5 !text-[11px]"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Kurulumu tamamla
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
