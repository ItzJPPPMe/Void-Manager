import { Heart, Trash2, Wand2, Check, Palette } from "lucide-react";
import clsx from "clsx";
import { useChampionStore } from "@/store/championStore";
import { useAppStore } from "@/store/appStore";
import { LazyImage } from "@/components/common/LazyImage";
import type { Skin, SkinSourceType } from "@/types/champion";

const SOURCE_BADGE: Record<
  SkinSourceType,
  { label: string; className: string }
> = {
  bettie9: { label: "Sunshine", className: "border-amber-400/40 text-amber-300" },
  alban1911: {
    label: "Rose",
    className: "border-fuchsia-400/40 text-fuchsia-300",
  },
  darkseal: { label: "Community", className: "border-sky-400/40 text-sky-300" },
  local: { label: "Yerel", className: "border-neon-lime/40 text-neon-lime" },
};

const RARITY_BADGE: Record<string, { label: string; className: string }> = {
  kUltimate: { label: "ULTIMATE", className: "border-red-400/50 bg-red-500/15 text-red-300" },
  kMythic: { label: "MYTHIC", className: "border-amber-400/50 bg-amber-500/15 text-amber-300" },
  kLegendary: { label: "EPİK", className: "border-purple-400/50 bg-purple-500/15 text-purple-300" },
  kEpic: { label: "EPİK", className: "border-purple-400/50 bg-purple-500/15 text-purple-300" },
  kExalted: { label: "EXALTED", className: "border-pink-400/50 bg-pink-500/15 text-pink-300" },
  kTranscendent: { label: "TRASCENDENT", className: "border-cyan-400/50 bg-cyan-500/15 text-cyan-300" },
  kRare: { label: "NADİR", className: "border-sky-400/50 bg-sky-500/15 text-sky-300" },
};

function primarySource(skin: Skin): SkinSourceType | null {
  return skin.sources.length > 0 ? skin.sources[0] : null;
}

interface SkinCardProps {
  skin: Skin;
}

export function SkinCard({ skin }: SkinCardProps) {
  const selectSkin = useChampionStore((s) => s.selectSkin);
  const selectedSkinId = useChampionStore((s) => s.selectedSkinId);
  const toggleFavorite = useChampionStore((s) => s.toggleFavorite);
  const showToast = useAppStore((s) => s.showToast);

  const isSelected = selectedSkinId === skin.id;
  const chromaCount = skin.chromas.length;
  const source = primarySource(skin);
  const rarity = RARITY_BADGE[skin.rarity];

  return (
    <article
      onClick={() => selectSkin(skin.id)}
      className={clsx(
        "group relative cursor-pointer overflow-hidden rounded-xl border bg-void-850 shadow-card transition duration-200",
        "[content-visibility:auto] [contain-intrinsic-size:auto_220px]",
        isSelected
          ? "border-neon-cyan/70 shadow-neon ring-1 ring-neon-cyan/40"
          : "border-white/5 hover:-translate-y-0.5 hover:border-neon-cyan/40",
      )}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-void-800">
        <LazyImage
          url={skin.splashUrl}
          alt={skin.name}
          wrapperClassName="h-full w-full"
          className="object-top group-hover:scale-105"
          objectPosition="top"
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-void-950 via-void-950/20 to-transparent" />

        <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-1">
          {rarity && (
            <span className={clsx("chip", rarity.className)}>{rarity.label}</span>
          )}
          {chromaCount > 0 && (
            <span className="chip border-neon-violet/50 bg-neon-violet/15 text-neon-violet">
              <Palette className="h-3 w-3" /> {chromaCount}
            </span>
          )}
          {skin.isLegacy && (
            <span className="chip border-rose-400/50 bg-rose-500/15 text-rose-300">
              LEGACY
            </span>
          )}
          {skin.ready && (
            <span className="chip border-neon-lime/50 bg-neon-lime/15 text-neon-lime">
              <Check className="h-3 w-3" /> HAZIR
            </span>
          )}
          {!skin.ready && skin.packageUrl && (
            <span className="chip border-neon-cyan/50 bg-neon-cyan/15 text-neon-cyan">
              MOD VAR
            </span>
          )}
        </div>

        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(skin.id);
            }}
            className={clsx(
              "flex h-8 w-8 items-center justify-center rounded-lg border backdrop-blur-md transition",
              skin.favorite
                ? "border-rose-400/50 bg-rose-500/20 text-rose-400"
                : "border-white/15 bg-black/40 text-slate-300 hover:border-rose-400/50 hover:text-rose-400",
            )}
            title="Favorilere ekle"
          >
            <Heart className={clsx("h-4 w-4", skin.favorite && "fill-current")} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              showToast(
                skin.packageUrl
                  ? `${skin.name} için mod paketi mevcut`
                  : `${skin.name} için mod paketi bulunamadı`,
                skin.packageUrl ? "info" : "error",
              );
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-black/40 text-slate-300 backdrop-blur-md transition hover:border-neon-magenta/50 hover:text-neon-magenta"
            title="Mod durumu"
          >
            <Wand2 className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              showToast(`${skin.id} silme isteği kuyruğa alındı`, "info");
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-black/40 text-slate-300 backdrop-blur-md transition hover:border-rose-400/50 hover:text-rose-400"
            title="Sil"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3
            className="truncate font-display text-sm font-semibold tracking-wide text-slate-100"
            title={skin.name}
          >
            {skin.name}
          </h3>
          {source && SOURCE_BADGE[source] && (
            <span
              className={clsx(
                "chip shrink-0 !px-1.5 !py-0 !text-[9px]",
                SOURCE_BADGE[source].className,
              )}
            >
              {SOURCE_BADGE[source].label}
            </span>
          )}
        </div>
        <p className="truncate text-[11px] leading-snug text-slate-400">
          {skin.championName}
          {skin.description ? ` · ${skin.description}` : ""}
        </p>
        <p className="font-mono text-[10px] text-slate-600">
          ID: {skin.id} · {skin.skinNum === 0 ? "Temel" : `#${skin.skinNum}`}
        </p>
      </div>
    </article>
  );
}
