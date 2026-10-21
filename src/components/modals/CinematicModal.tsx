import { useEffect, useState } from "react";
import {
  Heart,
  Maximize2,
  Package,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import clsx from "clsx";
import { useAppStore } from "@/store/appStore";
import { useChampionStore } from "@/store/championStore";
import { RARITY_BADGE } from "@/lib/skinMeta";
import { LazyImage } from "@/components/common/LazyImage";

export function CinematicModal() {
  const skinId = useAppStore((s) => s.cinematicSkinId);
  const setSkinId = useAppStore((s) => s.setCinematicSkinId);
  const setDetailSkinId = useAppStore((s) => s.setDetailSkinId);
  const skins = useChampionStore((s) => s.skins);
  const toggleFavorite = useChampionStore((s) => s.toggleFavorite);
  const [showInfo, setShowInfo] = useState(true);
  const [zoomed, setZoomed] = useState(false);

  const index = skins.findIndex((s) => s.id === skinId);
  const skin = index >= 0 ? skins[index] : null;

  useEffect(() => {
    if (skinId === null) {
      setShowInfo(true);
      setZoomed(false);
    }
  }, [skinId]);

  useEffect(() => {
    if (skinId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSkinId(null);
      if (e.key === "ArrowRight" && index < skins.length - 1) {
        setSkinId(skins[index + 1].id);
      }
      if (e.key === "ArrowLeft" && index > 0) {
        setSkinId(skins[index - 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [skinId, index, skins, setSkinId]);

  if (skinId === null || !skin) return null;

  const go = (delta: number) => {
    const next = index + delta;
    if (next >= 0 && next < skins.length) setSkinId(skins[next].id);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black">
      <div className="absolute inset-0 overflow-hidden">
        <LazyImage
          url={skin.splashUrl}
          alt={skin.name}
          wrapperClassName="h-full w-full"
          className={clsx(
            "transition-transform duration-[6000ms] ease-out",
            zoomed ? "scale-110" : "scale-100",
          )}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/60" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.65))]" />
      </div>

      <div className="absolute inset-x-0 top-0 flex items-center gap-2 p-5">
        <span className="chip border-neon-cyan/40 bg-black/40 text-neon-cyan">
          {skin.championName}
        </span>
        <span className="chip border-white/20 bg-black/40 text-slate-200">
          {RARITY_BADGE[skin.rarity]?.label ?? skin.rarity}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setZoomed((z) => !z)}
            className="btn-ghost !bg-black/40"
            title="Yakınlaştır"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setSkinId(null)}
            className="btn-ghost !bg-black/40"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <button
        onClick={() => go(-1)}
        disabled={index <= 0}
        className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/40 text-slate-200 transition hover:border-neon-cyan/50 hover:text-neon-cyan disabled:opacity-20"
        aria-label="Önceki"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={() => go(1)}
        disabled={index >= skins.length - 1}
        className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/40 text-slate-200 transition hover:border-neon-cyan/50 hover:text-neon-cyan disabled:opacity-20"
        aria-label="Sonraki"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <div
        className={clsx(
          "absolute inset-x-0 bottom-0 p-6 transition-all duration-300",
          showInfo ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
        )}
      >
        <div className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-void-900/70 p-5 backdrop-blur-xl">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-2xl font-bold tracking-wide text-slate-100">
                {skin.name}
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                {skin.championName} · {skin.chromas.length} chroma
              </p>
              {skin.description && (
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">
                  {skin.description}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <button
                onClick={() => toggleFavorite(skin.id)}
                className={clsx(
                  "btn-ghost !bg-black/30",
                  skin.favorite && "border-neon-magenta/50 text-neon-magenta",
                )}
              >
                <Heart
                  className={clsx("h-4 w-4", skin.favorite && "fill-current")}
                />
                {skin.favorite ? "Favoride" : "Favori"}
              </button>
              <button
                onClick={() => {
                  setDetailSkinId(skin.id);
                  setSkinId(null);
                }}
                className="btn-secondary"
              >
                <Package className="h-4 w-4" /> Detay
              </button>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setShowInfo((v) => !v)}
        className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest text-slate-600 transition hover:text-slate-400"
      >
        {showInfo ? "bilgiyi gizle" : "bilgiyi göster"}
      </button>
    </div>
  );
}
