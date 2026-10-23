import { useMemo, useState } from "react";
import { Heart, Hammer, PackagePlus, Search, X } from "lucide-react";
import { useChampionStore } from "@/store/championStore";
import { useAppStore } from "@/store/appStore";
import { VirtualSkinGrid } from "@/components/skins/VirtualSkinGrid";
import { importSkinsToVoid } from "@/services/skinTransfer";
import { voidModsBuildOverlay } from "@/services/voidEngine";
import { normalizeTr } from "@/lib/fuzzySearch";

export function FavoritesView() {
  const skins = useChampionStore((s) => s.skins);
  const loading = useChampionStore((s) => s.loading);
  const markSkinReady = useChampionStore((s) => s.markSkinReady);
  const showToast = useAppStore((s) => s.showToast);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );

  const favoriteSkins = useMemo(() => {
    const list = skins.filter((skin) => skin.favorite);
    const q = normalizeTr(query.trim());
    if (!q) return list;
    return list.filter(
      (skin) =>
        normalizeTr(skin.name).includes(q) ||
        normalizeTr(skin.championName).includes(q) ||
        String(skin.id).includes(q),
    );
  }, [skins, query]);

  const sendAllToVoid = async () => {
    const targets = favoriteSkins.filter((skin) => Boolean(skin.packageUrl));
    if (targets.length === 0) {
      showToast("Favorilerde mod paketi olan kostüm yok", "error");
      return;
    }
    setBusy(true);
    setProgress({ done: 0, total: targets.length });
    try {
      const { added, failed } = await importSkinsToVoid(targets, (done, total) =>
        setProgress({ done, total }),
      );
      for (const mod of added) {
        if (mod.skinId !== null) markSkinReady(mod.skinId, null);
      }
      if (added.length > 0) {
        showToast(`${added.length} favori VOID kütüphanesine eklendi`, "success");
        try {
          const summary = await voidModsBuildOverlay();
          showToast(`Overlay derlendi: ${summary.built.length} WAD`, "success");
        } catch (err) {
          showToast(
            typeof err === "string" ? err : "Overlay derlenemedi",
            "error",
          );
        }
      }
      if (failed.length > 0) {
        showToast(`${failed.length} favori eklenemedi`, "error");
      }
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const emptyState = (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-2 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-500/10">
        <Heart className="h-7 w-7 text-rose-300" />
      </div>
      <p className="font-display text-lg font-semibold text-slate-300">
        Henüz favori yok
      </p>
      <p className="max-w-sm text-xs text-slate-500">
        Kostüm kartlarındaki kalp simgesine tıklayarak favorilerine ekle.
      </p>
    </div>
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 fill-current text-rose-400" />
          <h1 className="font-display text-lg font-bold tracking-wide text-slate-100">
            Favorilerim
          </h1>
          <span className="rounded-full border border-white/15 bg-black/20 px-2 py-0.5 font-mono text-[11px] text-slate-300">
            {favoriteSkins.length}
          </span>
        </div>

        <div className="relative ml-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Favorilerde ara..."
            className="w-full rounded-lg border border-white/10 bg-void-800 py-2 pl-8 pr-8 text-sm outline-none transition placeholder:text-slate-500 focus:border-rose-400/50"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
              aria-label="Aramayı temizle"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <button
          onClick={() => void sendAllToVoid()}
          disabled={busy || favoriteSkins.length === 0}
          className="btn-secondary !py-2 !text-xs disabled:opacity-40"
        >
          <PackagePlus className="h-3.5 w-3.5" /> Tümünü VOID'e Ekle
        </button>
        <button
          onClick={() => {
            setBusy(true);
            void voidModsBuildOverlay()
              .then((summary) =>
                showToast(
                  `Overlay derlendi: ${summary.built.length} WAD`,
                  "success",
                ),
              )
              .catch((err) =>
                showToast(
                  typeof err === "string" ? err : "Overlay derlenemedi",
                  "error",
                ),
              )
              .finally(() => setBusy(false));
          }}
          disabled={busy}
          className="btn-ghost !py-2 !text-xs text-neon-violet disabled:opacity-40"
        >
          <Hammer className="h-3.5 w-3.5" /> Overlay Derle
        </button>
        {progress && (
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 font-mono text-[10px] text-slate-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-neon-cyan" />
            {progress.done}/{progress.total}
          </span>
        )}
      </header>

      <div className="min-h-0 flex-1">
        <VirtualSkinGrid
          skins={favoriteSkins}
          emptyState={emptyState}
          loading={loading && favoriteSkins.length === 0}
        />
      </div>
    </section>
  );
}
