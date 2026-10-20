import { useEffect, useMemo } from "react";
import { X, Heart, Check, Sparkles } from "lucide-react";
import clsx from "clsx";
import { useAppStore } from "@/store/appStore";
import { useChampionStore } from "@/store/championStore";
import { LazyImage } from "@/components/common/LazyImage";
import { RARITY_BADGE } from "@/lib/skinMeta";

export function ChampionGalleryModal() {
  const galleryChampionId = useAppStore((s) => s.galleryChampionId);
  const setGalleryChampionId = useAppStore((s) => s.setGalleryChampionId);
  const setDetailSkinId = useAppStore((s) => s.setDetailSkinId);
  const skins = useChampionStore((s) => s.skins);
  const selectSkin = useChampionStore((s) => s.selectSkin);
  const toggleFavorite = useChampionStore((s) => s.toggleFavorite);

  const championSkins = useMemo(() => {
    if (galleryChampionId == null) return [];
    return skins
      .filter((s) => s.championId === galleryChampionId)
      .sort((a, b) => a.skinNum - b.skinNum);
  }, [skins, galleryChampionId]);

  const championName = championSkins[0]?.championName ?? "Şampiyon";

  const close = () => setGalleryChampionId(null);

  const openSkin = (id: number) => {
    selectSkin(id);
    setDetailSkinId(id);
    close();
  };

  useEffect(() => {
    if (galleryChampionId == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [galleryChampionId]);

  if (galleryChampionId == null || championSkins.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm sm:p-8"
      onClick={close}
    >
      <div
        className="panel flex h-[86vh] w-full max-w-6xl animate-slideUp flex-col overflow-hidden !rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.3em] text-neon-cyan/80">
              Şampiyon Galerisi
            </p>
            <h2 className="font-display text-2xl font-bold tracking-wide">
              {championName}
            </h2>
            <p className="text-xs text-slate-400">
              {championSkins.length} kostüm · detay için görsele tıklayın
            </p>
          </div>
          <button onClick={close} className="btn-ghost !px-2.5" aria-label="Kapat">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
            {championSkins.map((skin) => {
              const rarity = RARITY_BADGE[skin.rarity];
              return (
                <button
                  key={skin.id}
                  onClick={() => openSkin(skin.id)}
                  className="group relative overflow-hidden rounded-xl border border-white/10 bg-void-900 text-left transition hover:border-neon-cyan/60"
                  title={skin.name}
                >
                  <LazyImage
                    url={skin.splashUrl || skin.loadScreenUrl}
                    alt={skin.name}
                    wrapperClassName="aspect-video w-full"
                    objectPosition="top"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-void-950 via-void-950/20 to-transparent" />

                  <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                    {rarity && (
                      <span className={clsx("chip !py-0", rarity.className)}>
                        {rarity.label}
                      </span>
                    )}
                    {skin.isBase && (
                      <span className="chip border-white/20 bg-black/50 !py-0 text-slate-300">
                        Temel
                      </span>
                    )}
                    {skin.ready && (
                      <span className="chip border-neon-lime/50 bg-neon-lime/15 !py-0 text-neon-lime">
                        <Check className="h-3 w-3" /> HAZIR
                      </span>
                    )}
                  </div>

                  <div className="absolute right-2 top-2 flex gap-1">
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(skin.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          e.preventDefault();
                          toggleFavorite(skin.id);
                        }
                      }}
                      className={clsx(
                        "flex h-7 w-7 items-center justify-center rounded-lg border backdrop-blur-md transition",
                        skin.favorite
                          ? "border-rose-400/60 bg-rose-500/20 text-rose-400"
                          : "border-white/15 bg-black/50 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-rose-400",
                      )}
                      title="Favori"
                    >
                      <Heart
                        className={clsx("h-3.5 w-3.5", skin.favorite && "fill-current")}
                      />
                    </span>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm font-semibold text-white">
                        {skin.name}
                      </p>
                      <p className="font-mono text-[10px] text-slate-400">
                        #{skin.skinNum}
                        {skin.chromas.length > 0
                          ? ` · ${skin.chromas.length} chroma`
                          : ""}
                      </p>
                    </div>
                    <Sparkles className="h-4 w-4 shrink-0 text-neon-violet opacity-0 transition group-hover:opacity-100" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
