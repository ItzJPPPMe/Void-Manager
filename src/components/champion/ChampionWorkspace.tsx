import { useMemo } from "react";
import { Search, X, Filter } from "lucide-react";
import clsx from "clsx";
import { useChampionStore } from "@/store/championStore";
import { SkinGrid } from "@/components/skins/SkinGrid";
import type { SkinFilter } from "@/types/champion";

const FILTERS: { id: SkinFilter; label: string }[] = [
  { id: "all", label: "Tüm Kostümler" },
  { id: "favorites", label: "Favoriler" },
  { id: "ready", label: "Hazır Kostümler" },
  { id: "chromas", label: "Chromalar" },
];

export function ChampionWorkspace() {
  const champions = useChampionStore((s) => s.champions);
  const selectedChampionId = useChampionStore((s) => s.selectedChampionId);
  const selectChampion = useChampionStore((s) => s.selectChampion);
  const skins = useChampionStore((s) => s.skins);
  const searchQuery = useChampionStore((s) => s.searchQuery);
  const setSearchQuery = useChampionStore((s) => s.setSearchQuery);
  const activeFilter = useChampionStore((s) => s.activeFilter);
  const setActiveFilter = useChampionStore((s) => s.setActiveFilter);
  const sourceFilter = useChampionStore((s) => s.sourceFilter);
  const setSourceFilter = useChampionStore((s) => s.setSourceFilter);

  const champion = useMemo(
    () => champions.find((c) => c.id === selectedChampionId) ?? null,
    [champions, selectedChampionId],
  );

  const filteredSkins = useMemo(() => {
    let list = selectedChampionId
      ? skins.filter((skin) => skin.championId === selectedChampionId)
      : skins;
    const q = searchQuery.trim().toLocaleLowerCase("tr-TR");
    if (q) {
      list = list.filter(
        (skin) =>
          skin.name.toLocaleLowerCase("tr-TR").includes(q) ||
          skin.championName.toLocaleLowerCase("tr-TR").includes(q) ||
          String(skin.id).includes(q) ||
          skin.description.toLocaleLowerCase("tr-TR").includes(q),
      );
    }
    switch (activeFilter) {
      case "favorites":
        list = list.filter((skin) => skin.favorite);
        break;
      case "ready":
        list = list.filter((skin) => skin.ready);
        break;
      case "chromas":
        list = list.filter((skin) => skin.chromas.length > 0);
        break;
    }
    if (sourceFilter !== "all") {
      list = list.filter((skin) => skin.sources.includes(sourceFilter));
    }
    return list;
  }, [skins, selectedChampionId, searchQuery, activeFilter, sourceFilter]);

  const championSkinCount = filteredSkins.length;

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-white/5 bg-void-900/60 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tüm şampiyonlar arasında skin ara..."
              className="w-full rounded-xl border border-white/10 bg-void-800 py-2.5 pl-10 pr-10 text-sm outline-none transition placeholder:text-slate-500 focus:border-neon-cyan/50 focus:shadow-neon"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-neon-cyan"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-void-800 p-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={clsx(
                  "rounded-lg px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-wide transition",
                  activeFilter === f.id
                    ? "bg-neon-cyan/15 text-neon-cyan shadow-neon"
                    : "text-slate-400 hover:text-slate-200",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-display text-2xl font-bold tracking-wide">
                {champion ? champion.name : "Tüm Kostümler"}
              </h2>
              {champion && (
                <button
                  onClick={() => selectChampion(null)}
                  className="btn-ghost !px-2 !py-0.5 !text-[11px]"
                >
                  <X className="h-3 w-3" /> Temizle
                </button>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              {championSkinCount} kostüm listeleniyor
              {champion?.title ? ` · ${champion.title}` : ""}
            </p>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-400">
            <Filter className="h-3.5 w-3.5" />
            Kaynak
            <select
              value={sourceFilter}
              onChange={(e) =>
                setSourceFilter(
                  e.target.value as typeof sourceFilter,
                )
              }
              className="rounded-lg border border-white/10 bg-void-800 px-2 py-1 text-xs text-slate-200 outline-none focus:border-neon-cyan/50"
            >
              <option value="all">Tüm kaynaklar</option>
              <option value="bettie9">Bettie9 / Sunshine</option>
              <option value="alban1911">Alban1911 / Rose</option>
              <option value="darkseal">darkseal-org</option>
              <option value="local">Yerel</option>
            </select>
          </label>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <SkinGrid skins={filteredSkins} />
      </div>
    </section>
  );
}
