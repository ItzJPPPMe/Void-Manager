import { SkinCard } from "./SkinCard";
import type { Skin } from "@/types/champion";
import type { GridDensity } from "@/types/settings";
import { useSettingsStore } from "@/store/settingsStore";

interface SkinGridProps {
  skins: Skin[];
}

const DENSITY_CLASS: Record<GridDensity, string> = {
  compact: "grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2.5",
  comfortable: "grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3",
  large: "grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5",
};

export function SkinGrid({ skins }: SkinGridProps) {
  const density = useSettingsStore((s) => s.settings.gridDensity);

  if (skins.length === 0) {
    return (
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-2 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <span className="font-display text-2xl text-slate-500">∅</span>
        </div>
        <p className="font-display text-lg font-semibold text-slate-400">
          Kostüm bulunamadı
        </p>
        <p className="max-w-sm text-xs text-slate-500">
          Filtreleri değiştirmeyi veya Ayarlar panelinden kaynak senkronizasyonunu
          yenilemeyi deneyin.
        </p>
      </div>
    );
  }

  return (
    <div className={DENSITY_CLASS[density]}>
      {skins.map((skin) => (
        <SkinCard key={skin.id} skin={skin} />
      ))}
    </div>
  );
}
