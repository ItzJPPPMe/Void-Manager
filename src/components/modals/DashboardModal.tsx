import { useMemo } from "react";
import {
  BarChart3,
  Heart,
  Package,
  Sparkles,
  Trophy,
  Users,
  X,
  Layers,
  Droplets,
} from "lucide-react";
import clsx from "clsx";
import { useChampionStore } from "@/store/championStore";
import { useCollectionStore } from "@/store/collectionStore";
import { useAppStore } from "@/store/appStore";
import { buildInsights } from "@/lib/suggestions";
import { RARITY_BADGE } from "@/lib/skinMeta";

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Heart;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="surface surface-hover relative overflow-hidden px-4 py-3.5">
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20 blur-2xl"
        style={{ background: accent }}
      />
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: `${accent}22`, color: accent }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="font-display text-xl font-bold leading-none text-slate-100">
            {value}
          </p>
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-500">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

function Bar({
  label,
  count,
  max,
  color,
  sub,
}: {
  label: string;
  count: number;
  max: number;
  color: string;
  sub?: string;
}) {
  const pct = max === 0 ? 0 : Math.round((count / max) * 100);
  return (
    <div className="group">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate text-slate-300">{label}</span>
        <span className="font-mono text-[11px] text-slate-500">
          {count}
          {sub ? ` · ${sub}` : ""}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

export function DashboardModal() {
  const open = useAppStore((s) => s.dashboardOpen);
  const setOpen = useAppStore((s) => s.setDashboardOpen);
  const skins = useChampionStore((s) => s.skins);
  const favorites = useCollectionStore((s) => s.favorites);
  const recent = useCollectionStore((s) => s.recent);

  const insights = useMemo(
    () => buildInsights(skins, favorites),
    [skins, favorites],
  );

  const rarityMax = insights.rarity.reduce((m, r) => Math.max(m, r.count), 0);
  const champMax = insights.championLeaderboard.reduce(
    (m, c) => Math.max(m, c.count),
    0,
  );
  const favMax = insights.topFavoriteChampions.reduce((m, c) => Math.max(m, c.count), 0);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="animate-pop-in glass flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-white/5 px-6 py-4">
          <BarChart3 className="h-5 w-5 text-neon-cyan" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-neon-cyan/80">
              Koleksiyon Panosu
            </p>
            <h2 className="font-display text-xl font-bold tracking-wide text-slate-100">
              Senin Koleksiyonun
            </h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="btn-ghost ml-auto !px-2.5"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard
              icon={Layers}
              label="Kostüm"
              value={insights.total}
              accent="#00f0ff"
            />
            <StatCard
              icon={Heart}
              label="Favori"
              value={insights.favorites}
              accent="#ff2e88"
            />
            <StatCard
              icon={Package}
              label="Hazır"
              value={insights.ready}
              accent="#a3ff12"
            />
            <StatCard
              icon={Users}
              label="Şampiyon"
              value={insights.champions}
              accent="#8b5cf6"
            />
            <StatCard
              icon={Droplets}
              label="Chroma"
              value={insights.withChroma}
              accent="#38bdf8"
            />
          </div>

          <div className="surface px-5 py-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-display font-semibold uppercase tracking-widest text-slate-400">
                Hazırlık Kapsamı
              </span>
              <span className="font-mono text-neon-cyan">%{insights.coverage}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-lime transition-all duration-700"
                style={{ width: `${insights.coverage}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              {insights.ready} / {insights.total} kostümde indirilmiş mod paketi var
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="surface p-5">
              <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-widest text-slate-300">
                <Sparkles className="h-3.5 w-3.5 text-neon-violet" />
                Nadirlik Dağılımı
              </h3>
              {insights.rarity.length === 0 ? (
                <p className="text-xs text-slate-600">Veri yok</p>
              ) : (
                <div className="space-y-2.5">
                  {insights.rarity.map((entry) => {
                    const badge = RARITY_BADGE[entry.rarity];
                    return (
                      <Bar
                        key={entry.rarity}
                        label={badge?.label ?? entry.rarity}
                        count={entry.count}
                        max={rarityMax}
                        color="rgb(var(--accent-rgb) / 0.75)"
                      />
                    );
                  })}
                </div>
              )}
            </section>

            <section className="surface p-5">
              <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-widest text-slate-300">
                <Trophy className="h-3.5 w-3.5 text-neon-amber" />
                En Çok Kostümü Olanlar
              </h3>
              {insights.championLeaderboard.length === 0 ? (
                <p className="text-xs text-slate-600">Veri yok</p>
              ) : (
                <div className="space-y-2.5">
                  {insights.championLeaderboard.map((entry) => (
                    <Bar
                      key={entry.championId}
                      label={entry.championName}
                      count={entry.count}
                      max={champMax}
                      color="rgb(var(--accent-rgb) / 0.6)"
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="surface p-5">
              <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-widest text-slate-300">
                <Heart className="h-3.5 w-3.5 text-neon-magenta" />
                Favori Şampiyonların
              </h3>
              {insights.topFavoriteChampions.length === 0 ? (
                <p className="text-xs text-slate-600">
                  Henüz favori yok. F (veya ♥) ile kostümleri favorileyebilirsin.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {insights.topFavoriteChampions.map((entry) => (
                    <Bar
                      key={entry.championId}
                      label={entry.championName}
                      count={entry.count}
                      max={favMax}
                      color="#ff2e88"
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="surface p-5">
              <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-widest text-slate-300">
                <Users className="h-3.5 w-3.5 text-neon-cyan" />
                Son Bakılanlar
              </h3>
              {recent.length === 0 ? (
                <p className="text-xs text-slate-600">Henüz kayıt yok</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {recent.slice(0, 16).map((id) => {
                    const skin = skins.find((s) => s.id === id);
                    return (
                      <span
                        key={id}
                        className={clsx(
                          "chip border-white/10 text-slate-300",
                          !skin && "opacity-40",
                        )}
                        title={skin?.name}
                      >
                        {skin?.name ?? `#${id}`}
                      </span>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
