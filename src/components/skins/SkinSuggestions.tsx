import { useMemo } from "react";
import { Wand2, ChevronRight } from "lucide-react";
import { useChampionStore } from "@/store/championStore";
import { useCollectionStore } from "@/store/collectionStore";
import { useAppStore } from "@/store/appStore";
import { useSettingsStore } from "@/store/settingsStore";
import { buildSuggestions } from "@/lib/suggestions";
import { LazyImage } from "@/components/common/LazyImage";
import { RARITY_BADGE } from "@/lib/skinMeta";
import clsx from "clsx";

export function SkinSuggestions() {
  const enabled = useSettingsStore((s) => s.settings.smartSuggestions);
  const skins = useChampionStore((s) => s.skins);
  const favorites = useCollectionStore((s) => s.favorites);
  const recent = useCollectionStore((s) => s.recent);
  const selectSkin = useChampionStore((s) => s.selectSkin);
  const selectChampion = useChampionStore((s) => s.selectChampion);
  const setDetailSkinId = useAppStore((s) => s.setDetailSkinId);
  const setCinematicSkinId = useAppStore((s) => s.setCinematicSkinId);

  const suggestions = useMemo(
    () => (enabled ? buildSuggestions(skins, favorites, recent, 14) : []),
    [enabled, skins, favorites, recent],
  );

  if (!enabled || suggestions.length === 0) return null;

  return (
    <section className="shrink-0 border-b border-white/5 bg-void-900/40 px-6 py-3">
      <div className="mb-2 flex items-center gap-2">
        <Wand2 className="h-3.5 w-3.5 text-neon-magenta" />
        <h3 className="font-display text-[11px] font-bold uppercase tracking-widest text-slate-400">
          Sana Öneriler
        </h3>
        <span className="text-[11px] text-slate-600">
          {suggestions.length} öneri
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {suggestions.map(({ skin, label }) => (
          <button
            key={skin.id}
            onClick={() => {
              selectChampion(skin.championId);
              selectSkin(skin.id);
              setDetailSkinId(skin.id);
            }}
            onDoubleClick={() => setCinematicSkinId(skin.id)}
            className="group relative h-[74px] w-[124px] shrink-0 overflow-hidden border border-white/[0.08] bg-void-800 transition hover:border-neon-cyan/50"
          >
            <LazyImage
              url={skin.splashUrl}
              alt={skin.name}
              wrapperClassName="h-full w-full"
              className="object-top group-hover:scale-110"
              objectPosition="top"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-void-950 via-void-950/30 to-transparent" />
            <div className="absolute inset-x-1.5 bottom-1.5 text-left">
              <p className="truncate text-[10px] font-semibold text-slate-100">
                {skin.name}
              </p>
              <p
                className={clsx(
                  "truncate text-[9px] uppercase tracking-wide",
                  "text-neon-cyan/80",
                )}
              >
                {label}
              </p>
            </div>
            <span
              className={clsx(
                "absolute right-1 top-1 chip !px-1.5 !py-0 !text-[8px]",
                RARITY_BADGE[skin.rarity]?.className,
              )}
            >
              {RARITY_BADGE[skin.rarity]?.label ?? skin.rarity}
            </span>
          </button>
        ))}
        <div className="flex h-[74px] shrink-0 items-center px-2 text-[10px] uppercase tracking-widest text-slate-700">
          <ChevronRight className="h-3 w-3" />
        </div>
      </div>
    </section>
  );
}
