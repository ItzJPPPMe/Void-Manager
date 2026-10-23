import { useMemo, useState } from "react";
import {
  Search,
  X,
  Filter,
  Shuffle,
  ArrowUpDown,
  Package,
  Images,
  CheckSquare,
  Heart,
  Trash2,
  Dices,
  BarChart3,
  Download,
  PackagePlus,
  PackageMinus,
  Hammer,
  Send,
} from "lucide-react";
import clsx from "clsx";
import { useChampionStore } from "@/store/championStore";
import type { RarityFilter, SkinSort } from "@/store/championStore";
import { useAppStore } from "@/store/appStore";
import { useCollectionStore } from "@/store/collectionStore";
import { useSelectionStore } from "@/store/selectionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { VirtualSkinGrid } from "@/components/skins/VirtualSkinGrid";
import { SkinSuggestions } from "@/components/skins/SkinSuggestions";
import { RARITY_BADGE, rarityRank } from "@/lib/skinMeta";
import { fuzzyRank, normalizeTr } from "@/lib/fuzzySearch";
import { applySkinToLtk } from "@/services/skinActions";
import { importSkinsToVoid } from "@/services/skinTransfer";
import {
  voidModsBuildOverlay,
  voidModsList,
  voidModsRemoveBySkin,
} from "@/services/voidEngine";
import type { SkinFilter } from "@/types/champion";

const FILTERS: { id: SkinFilter; label: string }[] = [
  { id: "all", label: "Tüm Kostümler" },
  { id: "favorites", label: "Favoriler" },
  { id: "ready", label: "Hazır Kostümler" },
  { id: "chromas", label: "Chromalar" },
];

const RARITIES: RarityFilter[] = [
  "kUltimate",
  "kExalted",
  "kMythic",
  "kTranscendent",
  "kLegendary",
  "kEpic",
  "kRare",
];

const SORTS: { id: SkinSort; label: string }[] = [
  { id: "default", label: "Varsayılan" },
  { id: "name", label: "İsim (A-Z)" },
  { id: "rarity", label: "Nadirlik" },
  { id: "champion", label: "Şampiyon" },
  { id: "id", label: "Kostüm ID" },
];

export function ChampionWorkspace() {
  const champions = useChampionStore((s) => s.champions);
  const selectedChampionId = useChampionStore((s) => s.selectedChampionId);
  const selectChampion = useChampionStore((s) => s.selectChampion);
  const selectSkin = useChampionStore((s) => s.selectSkin);
  const skins = useChampionStore((s) => s.skins);
  const loading = useChampionStore((s) => s.loading);
  const searchQuery = useChampionStore((s) => s.searchQuery);
  const setSearchQuery = useChampionStore((s) => s.setSearchQuery);
  const activeFilter = useChampionStore((s) => s.activeFilter);
  const setActiveFilter = useChampionStore((s) => s.setActiveFilter);
  const sourceFilter = useChampionStore((s) => s.sourceFilter);
  const setSourceFilter = useChampionStore((s) => s.setSourceFilter);
  const rarityFilter = useChampionStore((s) => s.rarityFilter);
  const setRarityFilter = useChampionStore((s) => s.setRarityFilter);
  const sortMode = useChampionStore((s) => s.sortMode);
  const setSortMode = useChampionStore((s) => s.setSortMode);
  const onlyWithPackage = useChampionStore((s) => s.onlyWithPackage);
  const setOnlyWithPackage = useChampionStore((s) => s.setOnlyWithPackage);
  const setDetailSkinId = useAppStore((s) => s.setDetailSkinId);
  const setRouletteOpen = useAppStore((s) => s.setRouletteOpen);
  const setDashboardOpen = useAppStore((s) => s.setDashboardOpen);
  const showToast = useAppStore((s) => s.showToast);
  const ltkStatus = useAppStore((s) => s.ltkStatus);
  const refreshLtk = useAppStore((s) => s.refreshLtk);
  const favorites = useCollectionStore((s) => s.favorites);
  const toggleFavorite = useChampionStore((s) => s.toggleFavorite);
  const markSkinReady = useChampionStore((s) => s.markSkinReady);
  const fuzzyEnabled = useSettingsStore((s) => s.settings.fuzzySearch);
  const sendTarget = useSettingsStore((s) => s.settings.sendTarget);
  const selectionActive = useSelectionStore((s) => s.active);
  const setSelectionActive = useSelectionStore((s) => s.setActive);
  const selectedIds = useSelectionStore((s) => s.ids);
  const clearSelection = useSelectionStore((s) => s.clear);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  const champion = useMemo(
    () => champions.find((c) => c.id === selectedChampionId) ?? null,
    [champions, selectedChampionId],
  );

  const filteredSkins = useMemo(() => {
    let list = selectedChampionId
      ? skins.filter((skin) => skin.championId === selectedChampionId)
      : skins;
    const q = searchQuery.trim();
    if (q) {
      if (fuzzyEnabled) {
        const ranked = fuzzyRank(
          list,
          q,
          (skin) =>
            `${skin.name} ${skin.championName} ${skin.id} ${skin.description}`,
        );
        list = ranked.map((r) => r.item);
      } else {
        const lower = normalizeTr(q);
        list = list.filter(
          (skin) =>
            normalizeTr(skin.name).includes(lower) ||
            normalizeTr(skin.championName).includes(lower) ||
            String(skin.id).includes(lower) ||
            normalizeTr(skin.description).includes(lower),
        );
      }
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
    if (rarityFilter !== "all") {
      list = list.filter((skin) => skin.rarity === rarityFilter);
    }
    if (onlyWithPackage) {
      list = list.filter((skin) => Boolean(skin.packageUrl));
    }
    if (sortMode !== "default") {
      list = [...list];
      const collator = new Intl.Collator("tr-TR", { sensitivity: "base" });
      switch (sortMode) {
        case "name":
          list.sort((a, b) => collator.compare(a.name, b.name));
          break;
        case "rarity":
          list.sort(
            (a, b) =>
              rarityRank(b.rarity) - rarityRank(a.rarity) ||
              collator.compare(a.championName, b.championName) ||
              a.skinNum - b.skinNum,
          );
          break;
        case "champion":
          list.sort(
            (a, b) =>
              collator.compare(a.championName, b.championName) ||
              a.skinNum - b.skinNum,
          );
          break;
        case "id":
          list.sort((a, b) => a.id - b.id);
          break;
      }
    }
    return list;
  }, [
    skins,
    selectedChampionId,
    searchQuery,
    activeFilter,
    sourceFilter,
    rarityFilter,
    onlyWithPackage,
    sortMode,
    fuzzyEnabled,
  ]);

  const hasActiveFilter =
    activeFilter !== "all" ||
    sourceFilter !== "all" ||
    rarityFilter !== "all" ||
    onlyWithPackage;

  const surprise = () => {
    if (filteredSkins.length === 0) return;
    const pick = filteredSkins[Math.floor(Math.random() * filteredSkins.length)];
    selectChampion(pick.championId);
    selectSkin(pick.id);
    setDetailSkinId(pick.id);
  };

  const resetFilters = () => {
    setActiveFilter("all");
    setSourceFilter("all");
    setRarityFilter("all");
    setOnlyWithPackage(false);
  };

  const bulkFavorite = () => {
    const list = skins.filter((s) => selectedIds.includes(s.id));
    let added = 0;
    for (const skin of list) {
      if (!favorites.includes(skin.id)) {
        toggleFavorite(skin.id);
        added += 1;
      }
    }
    showToast(`${added} kostüm favorilere eklendi`, "success");
    clearSelection();
    setSelectionActive(false);
  };

  const bulkUnfavorite = () => {
    let removed = 0;
    for (const id of selectedIds) {
      if (favorites.includes(id)) {
        toggleFavorite(id);
        removed += 1;
      }
    }
    showToast(`${removed} kostüm favorilerden çıkarıldı`, "info");
    clearSelection();
    setSelectionActive(false);
  };

  const describeError = (err: unknown, fallback: string) =>
    typeof err === "string"
      ? err
      : err instanceof Error
        ? err.message
        : fallback;

  const finishBulk = () => {
    setBulkBusy(false);
    setBulkProgress(null);
    clearSelection();
    setSelectionActive(false);
  };

  const bulkSendToVoid = async () => {
    const targets = skins.filter(
      (s) => selectedIds.includes(s.id) && Boolean(s.packageUrl),
    );
    if (targets.length === 0) {
      showToast("Seçilen kostümlerde mod paketi yok", "error");
      return;
    }
    setBulkBusy(true);
    setBulkProgress({ done: 0, total: targets.length });
    try {
      const { added, failed } = await importSkinsToVoid(targets, (done, total) =>
        setBulkProgress({ done, total }),
      );
      for (const mod of added) {
        if (mod.skinId !== null) markSkinReady(mod.skinId, null);
      }
      if (added.length > 0) {
        showToast(
          `${added.length} kostüm VOID kütüphanesine eklendi`,
          "success",
        );
      }
      if (failed.length > 0) {
        showToast(`${failed.length} kostüm eklenemedi`, "error");
      }
      if (added.length > 0) {
        try {
          const summary = await voidModsBuildOverlay();
          showToast(
            `Overlay derlendi: ${summary.built.length} WAD`,
            "success",
          );
        } catch (err) {
          showToast(describeError(err, "Overlay derlenemedi"), "error");
        }
      }
    } finally {
      finishBulk();
    }
  };

  const bulkSendToLtk = async () => {
    const targets = skins.filter(
      (s) => selectedIds.includes(s.id) && Boolean(s.packageUrl),
    );
    if (targets.length === 0) {
      showToast("Seçilen kostümlerde mod paketi yok", "error");
      return;
    }
    setBulkBusy(true);
    setBulkProgress({ done: 0, total: targets.length });
    try {
      const status = ltkStatus ?? (await refreshLtk());
      if (!status?.found) {
        showToast("LTK Manager bulunamadı", "error");
        return;
      }
      let sent = 0;
      let failed = 0;
      for (const skin of targets) {
        try {
          await applySkinToLtk(skin, null);
          sent += 1;
        } catch {
          failed += 1;
        }
        setBulkProgress((p) =>
          p ? { done: p.done + 1, total: p.total } : null,
        );
      }
      if (sent > 0) {
        showToast(`${sent} kostüm LTK Manager'a gönderildi`, "success");
      }
      if (failed > 0) {
        showToast(`${failed} kostüm gönderilemedi`, "error");
      }
    } finally {
      finishBulk();
    }
  };

  const bulkBuildOverlay = async () => {
    setBulkBusy(true);
    try {
      const summary = await voidModsBuildOverlay();
      showToast(
        `Overlay derlendi: ${summary.built.length} WAD, ${summary.buildTimeMs} ms`,
        "success",
      );
    } catch (err) {
      showToast(describeError(err, "Overlay derlenemedi"), "error");
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkRemoveVoid = async () => {
    setBulkBusy(true);
    try {
      const before = (await voidModsList()).length;
      for (const id of selectedIds) {
        await voidModsRemoveBySkin(id);
      }
      const after = (await voidModsList()).length;
      showToast(`${before - after} VOID modu kaldırıldı`, "info");
      clearSelection();
      setSelectionActive(false);
    } catch (err) {
      showToast(describeError(err, "VOID modları kaldırılamadı"), "error");
    } finally {
      setBulkBusy(false);
    }
  };

  const emptyState = (
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

        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-display text-2xl font-bold tracking-wide">
                {champion ? champion.name : "Tüm Kostümler"}
              </h2>
              {champion && (
                <>
                  <button
                    onClick={() =>
                      useAppStore.getState().setGalleryChampionId(champion.id)
                    }
                    className="btn-ghost !px-2 !py-0.5 !text-[11px]"
                    title="Şampiyonun tüm kostümlerini galeri olarak gör"
                  >
                    <Images className="h-3 w-3" /> Galeri
                  </button>
                  <button
                    onClick={() => selectChampion(null)}
                    className="btn-ghost !px-2 !py-0.5 !text-[11px]"
                  >
                    <X className="h-3 w-3" /> Temizle
                  </button>
                </>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              {filteredSkins.length} kostüm listeleniyor
              {champion?.title ? ` · ${champion.title}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <button
              onClick={() => setRouletteOpen(true)}
              disabled={filteredSkins.length === 0}
              className="btn-ghost !py-1.5 disabled:opacity-40"
              title="Rastgele kostüm çarkı"
            >
              <Dices className="h-3.5 w-3.5 text-neon-magenta" />
              Çark
            </button>

            <button
              onClick={() => setDashboardOpen(true)}
              className="btn-ghost !py-1.5"
              title="Koleksiyon panosu"
            >
              <BarChart3 className="h-3.5 w-3.5 text-neon-violet" />
              Pano
            </button>

            <button
              onClick={surprise}
              disabled={filteredSkins.length === 0}
              className="btn-ghost !py-1.5 disabled:opacity-40"
              title="Filtrelenen havuzdan rastgele kostüm seç"
            >
              <Shuffle className="h-3.5 w-3.5 text-neon-magenta" />
              Sürpriz
            </button>

            <button
              onClick={() => setOnlyWithPackage(!onlyWithPackage)}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 transition",
                onlyWithPackage
                  ? "border-neon-lime/50 bg-neon-lime/10 text-neon-lime"
                  : "border-white/10 bg-void-800 text-slate-400 hover:border-white/20",
              )}
              title="Yalnızca mod paketi bulunan kostümler"
            >
              <Package className="h-3.5 w-3.5" />
              Paketli
            </button>

            <label className="inline-flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5" />
              <select
                value={sourceFilter}
                onChange={(e) =>
                  setSourceFilter(e.target.value as typeof sourceFilter)
                }
                className="rounded-lg border border-white/10 bg-void-800 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-neon-cyan/50"
              >
                <option value="all">Tüm kaynaklar</option>
                <option value="bettie9">Bettie9 / Sunshine</option>
                <option value="alban1911">Alban1911 / Rose</option>
                <option value="darkseal">darkseal-org</option>
                <option value="local">Yerel</option>
              </select>
            </label>

            <select
              value={rarityFilter}
              onChange={(e) =>
                setRarityFilter(e.target.value as RarityFilter)
              }
              className="rounded-lg border border-white/10 bg-void-800 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-neon-cyan/50"
            >
              <option value="all">Tüm nadirlikler</option>
              {RARITIES.map((r) => (
                <option key={r} value={r}>
                  {RARITY_BADGE[r].label}
                </option>
              ))}
            </select>

            <label className="inline-flex items-center gap-1.5">
              <ArrowUpDown className="h-3.5 w-3.5" />
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SkinSort)}
                className="rounded-lg border border-white/10 bg-void-800 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-neon-cyan/50"
              >
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              onClick={() => setSelectionActive(!selectionActive)}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 transition",
                selectionActive
                  ? "border-neon-lime/50 bg-neon-lime/10 text-neon-lime"
                  : "border-white/10 bg-void-800 text-slate-400 hover:border-white/20",
              )}
              title="Çoklu seçim modu"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              Seç
            </button>

            {hasActiveFilter && (
              <button
                onClick={resetFilters}
                className="rounded-lg border border-white/10 px-2.5 py-1.5 text-slate-400 transition hover:border-rose-400/40 hover:text-rose-300"
              >
                Filtreleri sıfırla
              </button>
            )}
          </div>
        </div>

        {selectionActive && (
          <div className="animate-reveal-up mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-neon-lime/25 bg-neon-lime/5 px-4 py-2.5">
            <span className="text-xs font-semibold text-neon-lime">
              {selectedIds.length} kostüm seçildi
            </span>
            <button
              onClick={bulkFavorite}
              disabled={selectedIds.length === 0}
              className="btn-ghost !py-1 !text-[11px] disabled:opacity-40"
            >
              <Heart className="h-3.5 w-3.5" /> Favorilere ekle
            </button>
            <button
              onClick={bulkUnfavorite}
              disabled={selectedIds.length === 0}
              className="btn-ghost !py-1 !text-[11px] disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" /> Favorilerden çıkar
            </button>
            <button
              onClick={() => {
                setDetailSkinId(selectedIds[0] ?? null);
              }}
              disabled={selectedIds.length !== 1}
              className="btn-ghost !py-1 !text-[11px] disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" /> Detayı aç
            </button>
            {sendTarget === "void" ? (
              <button
                onClick={() => void bulkSendToVoid()}
                disabled={selectedIds.length === 0 || bulkBusy}
                className="btn-ghost !py-1 !text-[11px] text-neon-cyan disabled:opacity-40"
              >
                <PackagePlus className="h-3.5 w-3.5" /> VOID'e Ekle
              </button>
            ) : (
              <button
                onClick={() => void bulkSendToLtk()}
                disabled={selectedIds.length === 0 || bulkBusy}
                className="btn-ghost !py-1 !text-[11px] text-neon-cyan disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" /> LTK'ya Gönder
              </button>
            )}
            <button
              onClick={() => void bulkBuildOverlay()}
              disabled={bulkBusy}
              className="btn-ghost !py-1 !text-[11px] text-neon-violet disabled:opacity-40"
              title="Etkin VOID modlarından overlay derle"
            >
              <Hammer className="h-3.5 w-3.5" /> Overlay Derle
            </button>
            <button
              onClick={() => void bulkRemoveVoid()}
              disabled={selectedIds.length === 0 || bulkBusy}
              className="btn-ghost !py-1 !text-[11px] text-rose-300 disabled:opacity-40"
              title="Seçili kostümlerin VOID modlarını kaldır"
            >
              <PackageMinus className="h-3.5 w-3.5" /> VOID'den Çıkar
            </button>
            {bulkProgress && (
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 font-mono text-[10px] text-slate-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-neon-cyan" />
                {bulkProgress.done}/{bulkProgress.total}
              </span>
            )}
            <button
              onClick={() => {
                clearSelection();
                setSelectionActive(false);
              }}
              className="btn-ghost ml-auto !py-1 !text-[11px]"
            >
              <X className="h-3.5 w-3.5" /> Çık
            </button>
          </div>
        )}
      </header>

      <SkinSuggestions />

      <div className="min-h-0 flex-1">
        <VirtualSkinGrid
          skins={filteredSkins}
          emptyState={emptyState}
          loading={loading && filteredSkins.length === 0}
        />
      </div>
    </section>
  );
}
