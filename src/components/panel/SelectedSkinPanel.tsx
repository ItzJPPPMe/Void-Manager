import { useMemo, useState } from "react";
import { Download, Layers, Sparkles, Zap, ChevronDown } from "lucide-react";
import clsx from "clsx";
import { useChampionStore } from "@/store/championStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useAppStore } from "@/store/appStore";
import { ltkInstall } from "@/services/ltkManager";
import { LazyImage } from "@/components/common/LazyImage";

const PRESETS = [
  { id: "default", label: "Varsayılan" },
  { id: "high-contrast", label: "Yüksek Kontrast" },
  { id: "chroma-shift", label: "Chroma Kaydırma" },
  { id: "no-vfx", label: "VFX Kapalı" },
] as const;

export function SelectedSkinPanel() {
  const skins = useChampionStore((s) => s.skins);
  const selectedSkinId = useChampionStore((s) => s.selectedSkinId);
  const selectedChromaId = useChampionStore((s) => s.selectedChromaId);
  const selectChroma = useChampionStore((s) => s.selectChroma);
  const markSkinReady = useChampionStore((s) => s.markSkinReady);
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);
  const showToast = useAppStore((s) => s.showToast);
  const ltkStatus = useAppStore((s) => s.ltkStatus);
  const refreshLtk = useAppStore((s) => s.refreshLtk);
  const [preset, setPreset] = useState<string>("default");
  const [applying, setApplying] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);

  const skin = useMemo(
    () => skins.find((s) => s.id === selectedSkinId) ?? null,
    [skins, selectedSkinId],
  );

  const selectedChroma = useMemo(
    () => skin?.chromas.find((c) => c.id === selectedChromaId) ?? null,
    [skin, selectedChromaId],
  );

  const previewUrl = useMemo(() => {
    if (!skin) return null;
    return (
      selectedChroma?.imageUrl || skin.loadScreenUrl || skin.splashUrl || null
    );
  }, [skin, selectedChroma]);

  const handleApply = async () => {
    if (!skin) return;
    const remoteUrl = selectedChroma?.packageUrl ?? skin.packageUrl;
    if (!remoteUrl) {
      showToast(
        "Bu kostüm için mod paketi bulunamadı. Farklı bir kaynak etkinleştirin.",
        "error",
      );
      return;
    }
    setApplying(true);
    try {
      const status = ltkStatus ?? (await refreshLtk());
      if (!status?.found) {
        showToast(
          "LTK Manager bulunamadı. Kostümlerin oyunda görünmesi için LTK Manager gerekir.",
          "error",
        );
        return;
      }
      await ltkInstall(remoteUrl, skin.name, "VOID");
      markSkinReady(skin.id, remoteUrl);
      showToast(
        "LTK Manager'a gönderildi. Açılan pencerede onaylayıp modu açın ve Start ile yamayı başlatın.",
        "success",
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "LTK Manager'a gönderilemedi",
        "error",
      );
    } finally {
      setApplying(false);
    }
  };

  const canApply = Boolean(
    skin && (selectedChroma?.packageUrl || skin.packageUrl) && ltkStatus?.found,
  );

  return (
    <section className="relative z-10 shrink-0 border-t border-neon-cyan/20 bg-gradient-to-r from-void-900 via-void-850 to-void-900 px-6 py-3 backdrop-blur-md">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <LazyImage
            url={previewUrl}
            alt={skin?.name ?? "Seçili kostüm"}
            eager
            wrapperClassName="h-16 w-28 shrink-0 rounded-lg border border-white/10 bg-void-800"
            objectPosition="top"
          />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.25em] text-neon-cyan/70">
              Seçilen Kostüm
            </p>
            <h3 className="truncate font-display text-lg font-bold tracking-wide">
              {skin ? skin.name : "Kostüm seçilmedi"}
            </h3>
            <p className="truncate font-mono text-[10px] text-slate-500">
              {skin
                ? `${skin.championName} · skin_id: ${skin.id}`
                : "Kartlardan bir kostüm seçin"}
            </p>
          </div>
        </div>

        <div className="h-14 w-px bg-white/10" />

        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-widest text-slate-500">
              Varyant / Chroma
            </p>
            <div className="flex max-w-[280px] flex-wrap gap-1.5">
              <button
                onClick={() => selectChroma(null)}
                className={clsx(
                  "chip transition",
                  selectedChromaId === null
                    ? "border-neon-cyan/60 bg-neon-cyan/15 text-neon-cyan"
                    : "hover:border-white/25",
                )}
              >
                Orijinal
              </button>
              {skin?.chromas.slice(0, 6).map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectChroma(c.id)}
                  className={clsx(
                    "chip transition",
                    selectedChromaId === c.id
                      ? "border-neon-cyan/60 bg-neon-cyan/15 text-neon-cyan"
                      : "hover:border-white/25",
                  )}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  {c.name.replace(/^.*Chroma/, "Chroma")}
                </button>
              ))}
              {skin && skin.chromas.length > 6 && (
                <span className="chip text-slate-500">
                  +{skin.chromas.length - 6}
                </span>
              )}
              {skin && skin.chromas.length === 0 && (
                <span className="text-[11px] text-slate-600">
                  Bu kostümün chroma'sı yok
                </span>
              )}
            </div>
          </div>

          <div className="relative">
            <p className="mb-1 text-[10px] uppercase tracking-widest text-slate-500">
              Ön Ayar
            </p>
            <button
              onClick={() => setPresetOpen((v) => !v)}
              className="btn-ghost min-w-[160px] !justify-between"
            >
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                {PRESETS.find((p) => p.id === preset)?.label}
              </span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {presetOpen && (
              <div className="absolute bottom-full z-30 mb-2 w-48 overflow-hidden rounded-lg border border-white/10 bg-void-800 shadow-card">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setPreset(p.id);
                      setPresetOpen(false);
                    }}
                    className={clsx(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-white/5",
                      preset === p.id && "text-neon-cyan",
                    )}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300">
            <span className="text-[10px] uppercase tracking-widest text-slate-500">
              Oto uygulama
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoApply}
              onClick={() => updateSettings({ autoApply: !settings.autoApply })}
              className={clsx(
                "relative h-6 w-11 rounded-full border transition",
                settings.autoApply
                  ? "border-neon-cyan/60 bg-neon-cyan/25 shadow-neon"
                  : "border-white/15 bg-white/5",
              )}
            >
              <span
                className={clsx(
                  "absolute top-0.5 rounded-full transition-all",
                  settings.autoApply
                    ? "left-[calc(100%-1.25rem)] bg-neon-cyan"
                    : "left-0.5 bg-slate-500",
                )}
                style={{ height: "1.1rem", width: "1.1rem" }}
              />
            </button>
          </label>
        </div>

        <button
          onClick={() => void handleApply()}
          disabled={!canApply || applying}
          className={clsx(
            "btn-primary ml-auto min-w-[220px] !py-3 !text-base shadow-neon-violet",
            !canApply && "opacity-50",
          )}
          title={
            canApply
              ? "Kostümü LTK Manager'a gönder"
              : ltkStatus?.found
                ? "Mod paketi bulunamadı"
                : "LTK Manager bulunamadı"
          }
        >
          <Download className="h-5 w-5" />
          {applying
            ? "Gönderiliyor..."
            : !ltkStatus?.found
              ? "LTK Manager Yok"
              : canApply
                ? "LTK'ya Gönder"
                : "Paket Yok"}
        </button>
      </div>

      {skin && (
        <div className="mt-2 flex items-center gap-3 font-mono text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Zap className="h-3 w-3 text-neon-cyan" />
            Motor: {ltkStatus?.found ? "LTK Manager" : "yok"}
          </span>
          <span>
            Kaynak: {skin.sources.length > 0 ? skin.sources.join(", ") : "yok"}
          </span>
          <span>Durum: {skin.ready ? "kurulu" : "beklemede"}</span>
        </div>
      )}
    </section>
  );
}
