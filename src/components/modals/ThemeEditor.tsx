import { useEffect, useState } from "react";
import {
  Palette,
  RotateCcw,
  Sparkles,
  Square,
  Circle as CircleIcon,
  Waves,
} from "lucide-react";
import clsx from "clsx";
import { useSettingsStore } from "@/store/settingsStore";
import { useAppStore } from "@/store/appStore";
import { ACCENT_PRESETS, isValidHex } from "@/lib/theme";
import type { ThemeAccent, UiRadius } from "@/types/settings";

const RADIUS_OPTIONS: { id: UiRadius; label: string; icon: typeof Square }[] = [
  { id: "sharp", label: "Keskin", icon: Square },
  { id: "soft", label: "Yumuşak", icon: Waves },
  { id: "round", label: "Yuvarlak", icon: CircleIcon },
];

export function ThemeEditor() {
  const open = useAppStore((s) => s.themeEditorOpen);
  const setOpen = useAppStore((s) => s.setThemeEditorOpen);
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const showToast = useAppStore((s) => s.showToast);
  const [hexDraft, setHexDraft] = useState(settings.customAccent ?? "#00f0ff");

  useEffect(() => {
    if (open) setHexDraft(settings.customAccent ?? "#00f0ff");
  }, [open, settings.customAccent]);

  if (!open) return null;

  const accent = settings.customAccent;

  const applyAccent = (value: ThemeAccent) => {
    update({ themeAccent: value, customAccent: null });
  };

  const applyCustom = (value: string) => {
    if (!isValidHex(value)) {
      showToast("Geçerli bir hex renk gir (örn. #00f0ff)", "error");
      return;
    }
    update({ customAccent: value.startsWith("#") ? value : `#${value}` });
  };

  const reset = () => {
    update({
      themeAccent: "cyan",
      customAccent: null,
      glowIntensity: 55,
      uiRadius: "soft",
      animationsEnabled: true,
      animationSpeed: 1,
    });
    showToast("Tema varsayılanlara döndürüldü", "success");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="animate-pop-in glass max-h-[88vh] w-full max-w-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-white/5 px-6 py-4">
          <Palette className="h-5 w-5 text-neon-cyan" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-neon-cyan/80">
              Tema Editörü
            </p>
            <h2 className="font-display text-xl font-bold tracking-wide text-slate-100">
              Görünümü Kişiselleştir
            </h2>
          </div>
          <button
            onClick={reset}
            className="btn-ghost ml-auto !text-[11px]"
            title="Varsayılan temaya dön"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Sıfırla
          </button>
        </header>

        <div className="max-h-[calc(88vh-140px)] space-y-6 overflow-y-auto p-6">
          <section>
            <p className="mb-2 font-display text-xs font-semibold uppercase tracking-widest text-slate-400">
              Vurgu Rengi
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyAccent(preset.id)}
                  className={clsx(
                    "group relative flex items-center gap-2 border px-3 py-2 transition",
                    !accent && settings.themeAccent === preset.id
                      ? "border-white/30 bg-white/10"
                      : "border-white/10 bg-white/[0.03] hover:border-white/25",
                  )}
                >
                  <span
                    className="h-4 w-4 rounded-full"
                    style={{
                      background: preset.hex,
                      boxShadow: `0 0 10px ${preset.hex}80`,
                    }}
                  />
                  <span className="text-xs text-slate-200">{preset.label}</span>
                </button>
              ))}

              <div
                className={clsx(
                  "flex items-center gap-2 border px-3 py-2 transition",
                  accent
                    ? "border-white/30 bg-white/10"
                    : "border-white/10 bg-white/[0.03] hover:border-white/25",
                )}
              >
                <input
                  type="color"
                  value={accent ?? "#00f0ff"}
                  onChange={(e) => applyCustom(e.target.value)}
                  className="h-6 w-8 cursor-pointer rounded border border-white/10 bg-transparent p-0"
                  aria-label="Özel vurgu rengi"
                />
                <input
                  value={hexDraft}
                  onChange={(e) => setHexDraft(e.target.value)}
                  onBlur={() => applyCustom(hexDraft)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyCustom(hexDraft);
                  }}
                  className="w-20 bg-transparent font-mono text-xs text-slate-200 outline-none"
                  spellCheck={false}
                />
              </div>

              {accent && (
                <button
                  onClick={() => update({ customAccent: null })}
                  className="btn-ghost !px-2 !py-1.5 !text-[11px]"
                >
                  Özel rengi kaldır
                </button>
              )}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-display text-xs font-semibold uppercase tracking-widest text-slate-400">
                Parlama Yoğunluğu
              </p>
              <span className="font-mono text-xs text-neon-cyan">
                %{settings.glowIntensity}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.glowIntensity}
              onChange={(e) => update({ glowIntensity: Number(e.target.value) })}
              className="w-full accent-[rgb(var(--accent-rgb))]"
            />
            <div className="mt-3 flex justify-center">
              <div className="glow-strong flex h-16 w-32 items-center justify-center rounded-xl border border-neon-cyan/40 bg-void-800 font-display text-xs uppercase tracking-widest text-neon-cyan">
                Önizleme
              </div>
            </div>
          </section>

          <section>
            <p className="mb-2 font-display text-xs font-semibold uppercase tracking-widest text-slate-400">
              Köşe Yuvarlaklığı
            </p>
            <div className="flex gap-2">
              {RADIUS_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    onClick={() => update({ uiRadius: option.id })}
                    className={clsx(
                      "flex flex-1 items-center justify-center gap-2 border px-3 py-2.5 text-xs transition",
                      settings.uiRadius === option.id
                        ? "border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan"
                        : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <div className="flex items-center gap-3">
                <Sparkles className="h-4 w-4 text-neon-violet" />
                <div>
                  <p className="text-sm font-semibold">Animasyonlar</p>
                  <p className="text-[11px] text-slate-500">
                    Geçiş ve hareket efektlerini kapat
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  update({ animationsEnabled: !settings.animationsEnabled })
                }
                className={clsx(
                  "relative h-5 w-9 shrink-0 rounded-full transition",
                  settings.animationsEnabled
                    ? "bg-neon-violet/80"
                    : "bg-white/10",
                )}
              >
                <span
                  className={clsx(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
                    settings.animationsEnabled ? "left-4" : "left-0.5",
                  )}
                />
              </button>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="font-display text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Animasyon Hızı
                </p>
                <span className="font-mono text-xs text-neon-cyan">
                  {settings.animationSpeed.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.05}
                value={settings.animationSpeed}
                onChange={(e) =>
                  update({ animationSpeed: Number(e.target.value) })
                }
                disabled={!settings.animationsEnabled}
                className="w-full accent-[rgb(var(--accent-rgb))] disabled:opacity-40"
              />
            </div>
          </section>
        </div>

        <footer className="flex justify-end gap-2 border-t border-white/5 px-6 py-4">
          <button onClick={() => setOpen(false)} className="btn-primary">
            Tamam
          </button>
        </footer>
      </div>
    </div>
  );
}
