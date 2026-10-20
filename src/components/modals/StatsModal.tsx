import { useEffect, useMemo, useState } from "react";
import {
  X,
  BarChart3,
  Heart,
  Check,
  Layers,
  Package,
  Clock,
  HardDrive,
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { useChampionStore } from "@/store/championStore";
import { useSettingsStore } from "@/store/settingsStore";
import { imageCacheStats, type CacheStats } from "@/services/ltkManager";
import { RARITY_BADGE, SOURCE_BADGE, rarityRank } from "@/lib/skinMeta";
import type { SkinSourceType } from "@/types/champion";

const SOURCE_ORDER: SkinSourceType[] = [
  "bettie9",
  "alban1911",
  "darkseal",
  "local",
];

export function StatsModal() {
  const setStatsOpen = useAppStore((s) => s.setStatsOpen);
  const showToast = useAppStore((s) => s.showToast);
  const library = useAppStore((s) => s.library);
  const ltkStatus = useAppStore((s) => s.ltkStatus);
  const champions = useChampionStore((s) => s.champions);
  const skins = useChampionStore((s) => s.skins);
  const lastSyncedAt = useSettingsStore((s) => s.sync.lastSyncedAt);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);

  useEffect(() => {
    void imageCacheStats()
      .then(setCacheStats)
      .catch(() => setCacheStats(null));
  }, []);

  const stats = useMemo(() => {
    const favorites = skins.filter((s) => s.favorite).length;
    const ready = skins.filter((s) => s.ready).length;
    const withPackage = skins.filter((s) => s.packageUrl).length;
    const chromas = skins.reduce((sum, s) => sum + s.chromas.length, 0);
    const sources = SOURCE_ORDER.map((id) => ({
      id,
      count: skins.filter((s) => s.sources.includes(id)).length,
    })).filter((s) => s.count > 0);
    const rarities = Object.entries(
      skins.reduce<Record<string, number>>((acc, skin) => {
        acc[skin.rarity] = (acc[skin.rarity] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .filter(([rarity]) => rarity !== "kNoRarity")
      .sort((a, b) => rarityRank(b[0]) - rarityRank(a[0]));
    return {
      favorites,
      ready,
      withPackage,
      chromas,
      sources,
      rarities,
      mods: library?.mods.length ?? 0,
      enabledMods: library?.mods.filter((m) => m.enabled).length ?? 0,
    };
  }, [skins, library]);

  const total = Math.max(skins.length, 1);

  const summary = [
    { label: "Kostüm", value: skins.length, icon: Layers, tone: "text-neon-cyan" },
    { label: "Şampiyon", value: champions.length, icon: BarChart3, tone: "text-neon-violet" },
    { label: "Favori", value: stats.favorites, icon: Heart, tone: "text-rose-400" },
    { label: "Hazır", value: stats.ready, icon: Check, tone: "text-neon-lime" },
  ];

  const handleCopy = async () => {
    const lines = [
      `VOID Skin Manager özeti`,
      `Kostüm: ${skins.length} · Şampiyon: ${champions.length}`,
      `Favori: ${stats.favorites} · Hazır: ${stats.ready} · Paketli: ${stats.withPackage}`,
      `Mod: ${stats.enabledMods}/${stats.mods} etkin`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      showToast("Özet panoya kopyalandı", "success");
    } catch {
      showToast("Panoya kopyalanamadı", "error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
      onClick={() => setStatsOpen(false)}
    >
      <div
        className="panel flex max-h-[86vh] w-full max-w-2xl animate-slideUp flex-col overflow-hidden !rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-white/5 px-6 py-4">
          <div>
            <h2 className="font-display text-xl font-bold tracking-wide neon-text">
              İstatistikler
            </h2>
            <p className="text-xs text-slate-400">
              Koleksiyonun ve mod kütüphanesinin özeti
            </p>
          </div>
          <button
            onClick={() => setStatsOpen(false)}
            className="btn-ghost !px-2.5"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {summary.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
              >
                <item.icon className={`h-4 w-4 ${item.tone}`} />
                <p className="mt-2 font-display text-2xl font-bold">
                  {item.value}
                </p>
                <p className="text-[10px] uppercase tracking-widest text-slate-500">
                  {item.label}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <Package className="h-4 w-4 text-neon-cyan" />
              <div>
                <p className="text-sm font-semibold">{stats.withPackage}</p>
                <p className="text-[10px] uppercase tracking-wide text-slate-500">
                  mod paketi olan
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <Layers className="h-4 w-4 text-neon-violet" />
              <div>
                <p className="text-sm font-semibold">{stats.chromas}</p>
                <p className="text-[10px] uppercase tracking-wide text-slate-500">
                  toplam chroma
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <Check className="h-4 w-4 text-neon-lime" />
              <div>
                <p className="text-sm font-semibold">
                  {stats.enabledMods}/{stats.mods}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-slate-500">
                  etkin mod
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 font-display text-xs font-semibold uppercase tracking-wide text-slate-400">
              Kaynak dağılımı
            </p>
            {stats.sources.length === 0 ? (
              <p className="text-xs text-slate-600">Henüz veri yok</p>
            ) : (
              <div className="space-y-2">
                {stats.sources.map((source) => (
                  <div key={source.id} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs text-slate-400">
                      {SOURCE_BADGE[source.id].label}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-neon-cyan/70"
                        style={{ width: `${(source.count / total) * 100}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right font-mono text-[11px] text-slate-500">
                      {source.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {stats.rarities.length > 0 && (
            <div>
              <p className="mb-2 font-display text-xs font-semibold uppercase tracking-wide text-slate-400">
                Nadirlik dağılımı
              </p>
              <div className="flex flex-wrap gap-1.5">
                {stats.rarities.map(([rarity, count]) => (
                  <span
                    key={rarity}
                    className={`chip ${RARITY_BADGE[rarity]?.className ?? ""}`}
                  >
                    {RARITY_BADGE[rarity]?.label ?? rarity} · {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 font-mono text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Son senkron:{" "}
              {lastSyncedAt
                ? new Date(lastSyncedAt).toLocaleString("tr-TR")
                : "hiç"}
            </span>
            <span>LTK: {ltkStatus?.found ? "kurulu" : "yok"}</span>
            <span>
              Patcher: {ltkStatus?.patcherRunning ? "çalışıyor" : "durdu"}
            </span>
            {cacheStats && (
              <span className="inline-flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5" />
                Önbellek: {cacheStats.files} görsel ·{" "}
                {cacheStats.mb.toFixed(1)} MB
              </span>
            )}
          </div>
        </div>

        <footer className="flex justify-end border-t border-white/5 px-6 py-3">
          <button onClick={() => void handleCopy()} className="btn-ghost">
            Özeti kopyala
          </button>
        </footer>
      </div>
    </div>
  );
}
