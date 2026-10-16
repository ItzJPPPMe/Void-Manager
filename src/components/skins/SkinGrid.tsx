import { SkinCard } from "./SkinCard";
import type { Skin } from "@/types/champion";

interface SkinGridProps {
  skins: Skin[];
}

export function SkinGrid({ skins }: SkinGridProps) {
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
    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
      {skins.map((skin) => (
        <SkinCard key={skin.id} skin={skin} />
      ))}
    </div>
  );
}
