import { useMemo, useState } from "react";
import {
  Search,
  Settings2,
  Swords,
  Layers,
  Package,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import clsx from "clsx";
import { useChampionStore } from "@/store/championStore";
import { useAppStore } from "@/store/appStore";
import { useImageCache } from "@/hooks/useImageCache";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function ChampionIcon({ path }: { path: string }) {
  const { src } = useImageCache(path || null);
  if (!src) {
    return (
      <span className="h-6 w-6 shrink-0 rounded-md border border-white/10 bg-white/5" />
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="h-6 w-6 shrink-0 rounded-md border border-white/10 object-cover"
    />
  );
}

export function Sidebar() {
  const champions = useChampionStore((s) => s.champions);
  const selectedChampionId = useChampionStore((s) => s.selectedChampionId);
  const selectChampion = useChampionStore((s) => s.selectChampion);
  const championSearchQuery = useChampionStore((s) => s.championSearchQuery);
  const setChampionSearchQuery = useChampionStore(
    (s) => s.setChampionSearchQuery,
  );
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const library = useAppStore((s) => s.library);
  const libraryLoading = useAppStore((s) => s.libraryLoading);
  const refreshLibrary = useAppStore((s) => s.refreshLibrary);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  const enabledCount = library?.mods.filter((m) => m.enabled).length ?? 0;
  const totalMods = library?.mods.length ?? 0;

  const grouped = useMemo(() => {
    const filtered = champions.filter((c) =>
      c.name.toLowerCase().includes(championSearchQuery.toLowerCase()),
    );
    const map = new Map<string, typeof champions>();
    for (const c of filtered) {
      const letter = c.name.charAt(0).toUpperCase();
      if (!/^[A-Z]$/.test(letter)) continue;
      const arr = map.get(letter) ?? [];
      arr.push(c);
      map.set(letter, arr);
    }
    return map;
  }, [champions, championSearchQuery]);

  const letters = useMemo(() => {
    return new Set(grouped.keys());
  }, [grouped]);

  const scrollToLetter = (letter: string) => {
    setActiveLetter(letter);
    document.getElementById(`champ-letter-${letter}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <aside className="relative z-10 flex w-64 shrink-0 flex-col border-r border-white/5 bg-void-900/85 backdrop-blur-md">
      <div className="border-b border-white/5 px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-neon-cyan to-neon-violet shadow-neon">
            <Swords className="h-5 w-5 text-void-950" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold leading-none tracking-widest neon-text">
              VOID
            </h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
              Skin Manager
            </p>
          </div>
        </div>
      </div>

      <div className="border-b border-white/5 px-3 py-3">
        <div className="flex gap-1.5">
          <button
            onClick={() => setView("skins")}
            className={clsx(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition",
              view === "skins"
                ? "bg-neon-cyan/15 text-neon-cyan shadow-neon"
                : "text-slate-400 hover:bg-white/5",
            )}
          >
            <Swords className="h-4 w-4" />
            Kostümler
          </button>
          <button
            onClick={() => {
              setView("mods");
              void refreshLibrary();
            }}
            className={clsx(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition",
              view === "mods"
                ? "bg-neon-violet/20 text-neon-violet shadow-neon"
                : "text-slate-400 hover:bg-white/5",
            )}
          >
            <Package className="h-4 w-4" />
            Modlar
          </button>
        </div>
      </div>

      {view === "skins" ? (
        <>
          <div className="px-3 pt-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={championSearchQuery}
                onChange={(e) => setChampionSearchQuery(e.target.value)}
                placeholder="Şampiyon ara..."
                className="w-full rounded-lg border border-white/10 bg-void-800 py-2 pl-8 pr-3 text-sm outline-none transition placeholder:text-slate-500 focus:border-neon-cyan/50 focus:shadow-neon"
              />
            </div>
          </div>

          <div className="flex min-h-0 flex-1">
            <div className="flex w-8 shrink-0 flex-col items-center gap-0.5 overflow-y-auto py-2">
              {ALPHABET.map((letter) => (
                <button
                  key={letter}
                  onClick={() => scrollToLetter(letter)}
                  disabled={!letters.has(letter)}
                  className={clsx(
                    "h-5 w-6 rounded text-[10px] font-bold transition",
                    letters.has(letter)
                      ? "text-slate-400 hover:bg-neon-cyan/10 hover:text-neon-cyan"
                      : "cursor-default text-slate-700",
                    activeLetter === letter && "bg-neon-cyan/20 text-neon-cyan",
                  )}
                >
                  {letter}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              {grouped.size === 0 && (
                <p className="px-2 py-6 text-center text-xs text-slate-500">
                  Henüz senkronize edilmiş şampiyon yok.
                </p>
              )}
              {Array.from(grouped.entries()).map(([letter, list]) => (
                <div key={letter} id={`champ-letter-${letter}`}>
                  <div className="sticky top-0 z-10 bg-void-900/95 px-2 py-1 font-display text-[11px] font-bold tracking-widest text-neon-cyan/70">
                    {letter}
                  </div>
                  {list.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => selectChampion(c.id)}
                      className={clsx(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition",
                        selectedChampionId === c.id
                          ? "bg-neon-cyan/15 text-neon-cyan shadow-neon"
                          : "text-slate-300 hover:bg-white/5",
                      )}
                    >
                      <ChampionIcon path={c.iconUrl} />
                      <span className="truncate">{c.name}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <div className="flex items-center justify-between">
            <p className="font-display text-[11px] font-bold uppercase tracking-widest text-neon-violet/80">
              LTK Kütüphanesi
            </p>
            <button
              onClick={() => void refreshLibrary()}
              disabled={libraryLoading}
              className="rounded p-1 text-slate-400 transition hover:bg-white/5 hover:text-neon-violet"
              title="Yenile"
            >
              <RefreshCw
                className={clsx("h-3.5 w-3.5", libraryLoading && "animate-spin")}
              />
            </button>
          </div>

          <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-void-800/60 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Etkin profil</span>
              <span className="font-semibold text-slate-200">
                {library?.activeProfile ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Yüklü mod</span>
              <span className="font-mono font-semibold text-slate-200">
                {totalMods}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Etkin mod</span>
              <span className="inline-flex items-center gap-1 font-mono font-semibold text-neon-lime">
                <CheckCircle2 className="h-3 w-3" />
                {enabledCount}
              </span>
            </div>
          </div>

          <p className="mt-4 px-1 text-[11px] leading-relaxed text-slate-500">
            Modları yönetmek, yeni paket içe aktarmak ve patcher'ı kontrol etmek için
            sağdaki <span className="text-neon-violet">Modlar</span> ekranını kullanın.
          </p>
        </div>
      )}

      <div className="border-t border-white/5 p-3">
        <button
          onClick={() => setSettingsOpen(true)}
          className="btn-ghost w-full"
        >
          <Settings2 className="h-4 w-4" />
          Ayarlar
        </button>
        <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-slate-500">
          {view === "skins" ? (
            <span className="inline-flex items-center gap-1">
              <Layers className="h-3 w-3" /> Kaynak: {champions.length}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Package className="h-3 w-3" /> Mod: {totalMods}
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
