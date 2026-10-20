import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import {
  Search,
  Swords,
  Sparkles,
  Layers,
  Shuffle,
  Settings2,
  BarChart3,
  Keyboard,
  RefreshCw,
  Trash2,
  Heart,
  CheckCircle2,
  ArrowRight,
  Images,
} from "lucide-react";
import clsx from "clsx";
import { useChampionStore } from "@/store/championStore";
import { useCollectionStore } from "@/store/collectionStore";
import { useAppStore } from "@/store/appStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useRepositories } from "@/hooks/useRepositories";
import { useImageCache } from "@/hooks/useImageCache";
import { getImageLoader } from "@/services/imageLoader";
import { checkForUpdate } from "@/services/updateService";
import type { Skin } from "@/types/champion";

type Group = "Son Bakılanlar" | "Şampiyonlar" | "Kostümler" | "Eylemler";

interface CommandItem {
  key: string;
  group: Group;
  label: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
}

function ChampionAvatar({ url }: { url: string }) {
  const { src } = useImageCache(url || null);
  return src ? (
    <img src={src} alt="" className="h-5 w-5 rounded" />
  ) : (
    <span className="h-5 w-5 rounded bg-white/10" />
  );
}

export function CommandPalette() {
  const paletteOpen = useAppStore((s) => s.paletteOpen);
  const setPaletteOpen = useAppStore((s) => s.setPaletteOpen);
  const setView = useAppStore((s) => s.setView);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const setDetailSkinId = useAppStore((s) => s.setDetailSkinId);
  const setStatsOpen = useAppStore((s) => s.setStatsOpen);
  const setShortcutsOpen = useAppStore((s) => s.setShortcutsOpen);
  const setUpdateInfo = useAppStore((s) => s.setUpdateInfo);
  const setGalleryChampionId = useAppStore((s) => s.setGalleryChampionId);
  const showToast = useAppStore((s) => s.showToast);

  const champions = useChampionStore((s) => s.champions);
  const skins = useChampionStore((s) => s.skins);
  const selectChampion = useChampionStore((s) => s.selectChampion);
  const selectSkin = useChampionStore((s) => s.selectSkin);
  const setActiveFilter = useChampionStore((s) => s.setActiveFilter);
  const recentIds = useCollectionStore((s) => s.recent);
  const syncRunning = useSettingsStore((s) => s.sync.running);
  const { sync } = useRepositories();

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (paletteOpen) {
      setQuery("");
      setActive(0);
      const timer = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(timer);
    }
  }, [paletteOpen]);

  const items = useMemo<CommandItem[]>(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    const close = () => setPaletteOpen(false);
    const match = (text: string) =>
      !q || text.toLocaleLowerCase("tr-TR").includes(q);

    const recentItems: CommandItem[] = q
      ? []
      : recentIds
          .map((id) => skins.find((s) => s.id === id))
          .filter((s): s is Skin => Boolean(s))
          .slice(0, 4)
          .map((s) => ({
            key: `recent-${s.id}`,
            group: "Son Bakılanlar",
            label: s.name,
            hint: s.championName,
            icon: <Heart className="h-4 w-4 text-neon-magenta" />,
            run: () => {
              setView("skins");
              selectChampion(s.championId);
              selectSkin(s.id);
              setDetailSkinId(s.id);
              close();
            },
          }));

    const championItems: CommandItem[] = champions
      .filter((c) => match(c.name) || match(c.title))
      .slice(0, q ? 5 : 4)
      .map((c) => ({
        key: `champ-${c.id}`,
        group: "Şampiyonlar",
        label: c.name,
        hint: c.title,
        icon: <ChampionAvatar url={c.iconUrl} />,
        run: () => {
          setView("skins");
          selectChampion(c.id);
          close();
        },
      }));

    const skinItems: CommandItem[] = skins
      .filter(
        (s) =>
          match(s.name) ||
          (q.length > 1 && match(s.championName)) ||
          String(s.id) === q,
      )
      .slice(0, q ? 8 : 3)
      .map((s) => ({
        key: `skin-${s.id}`,
        group: "Kostümler",
        label: s.name,
        hint: s.championName,
        icon: <Layers className="h-4 w-4 text-neon-violet" />,
        run: () => {
          setView("skins");
          selectChampion(s.championId);
          selectSkin(s.id);
          setDetailSkinId(s.id);
          close();
        },
      }));

    const allActions: CommandItem[] = [
      {
        key: "act-random",
        group: "Eylemler",
        label: "Rastgele kostüm seç",
        hint: "Sürpriz beni",
        icon: <Shuffle className="h-4 w-4 text-neon-magenta" />,
        run: () => {
          if (skins.length === 0) {
            showToast("Henüz kostüm yüklenmedi", "error");
            close();
            return;
          }
          const pick = skins[Math.floor(Math.random() * skins.length)];
          setView("skins");
          selectChampion(pick.championId);
          selectSkin(pick.id);
          setDetailSkinId(pick.id);
          close();
        },
      },
      {
        key: "act-favorites",
        group: "Eylemler",
        label: "Favorileri göster",
        icon: <Heart className="h-4 w-4 text-rose-400" />,
        run: () => {
          setView("skins");
          selectChampion(null);
          setActiveFilter("favorites");
          close();
        },
      },
      {
        key: "act-ready",
        group: "Eylemler",
        label: "Hazır kostümleri göster",
        icon: <CheckCircle2 className="h-4 w-4 text-neon-lime" />,
        run: () => {
          setView("skins");
          selectChampion(null);
          setActiveFilter("ready");
          close();
        },
      },
      {
        key: "act-mods",
        group: "Eylemler",
        label: "Modlar görünümüne geç",
        icon: <Sparkles className="h-4 w-4 text-neon-cyan" />,
        run: () => {
          setView("mods");
          close();
        },
      },
      {
        key: "act-gallery",
        group: "Eylemler",
        label: "Şampiyon galerisini aç",
        hint: "Tüm kostümler",
        icon: <Images className="h-4 w-4 text-neon-violet" />,
        run: () => {
          const championId = useChampionStore.getState().selectedChampionId;
          if (championId === null) {
            showToast("Önce bir şampiyon seçin", "error");
            close();
            return;
          }
          setView("skins");
          setGalleryChampionId(championId);
          close();
        },
      },
      {
        key: "act-sync",
        group: "Eylemler",
        label: syncRunning
          ? "Senkronizasyon sürüyor..."
          : "Kaynakları senkronize et",
        icon: <RefreshCw className="h-4 w-4 text-neon-cyan" />,
        run: () => {
          close();
          if (syncRunning) return;
          void sync();
          showToast("Senkronizasyon başlatıldı", "info");
        },
      },
      {
        key: "act-update",
        group: "Eylemler",
        label: "Güncellemeyi denetle",
        icon: <ArrowRight className="h-4 w-4 text-neon-lime" />,
        run: () => {
          close();
          void (async () => {
            try {
              const info = await checkForUpdate();
              setUpdateInfo(info);
              showToast(
                info ? `Yeni sürüm mevcut: v${info.latest}` : "Uygulama güncel",
                info ? "success" : "info",
              );
            } catch {
              showToast("Güncelleme kontrol edilemedi", "error");
            }
          })();
        },
      },
      {
        key: "act-cache",
        group: "Eylemler",
        label: "Görsel önbelleğini temizle",
        icon: <Trash2 className="h-4 w-4 text-rose-400" />,
        run: () => {
          close();
          void (async () => {
            try {
              const mb = await getImageLoader().clearCache();
              showToast(`${mb.toFixed(1)} MB önbellek temizlendi`, "success");
            } catch {
              showToast("Önbellek temizlenemedi", "error");
            }
          })();
        },
      },
      {
        key: "act-stats",
        group: "Eylemler",
        label: "İstatistikler",
        icon: <BarChart3 className="h-4 w-4 text-neon-violet" />,
        run: () => {
          setStatsOpen(true);
          close();
        },
      },
      {
        key: "act-settings",
        group: "Eylemler",
        label: "Ayarlar",
        icon: <Settings2 className="h-4 w-4 text-slate-300" />,
        run: () => {
          setSettingsOpen(true);
          close();
        },
      },
      {
        key: "act-shortcuts",
        group: "Eylemler",
        label: "Klavye kısayolları",
        icon: <Keyboard className="h-4 w-4 text-slate-300" />,
        run: () => {
          setShortcutsOpen(true);
          close();
        },
      },
    ];

    const actions = allActions.filter(
      (a) => match(a.label) || match(a.hint ?? ""),
    );

    return [...recentItems, ...championItems, ...skinItems, ...actions];
  }, [
    query,
    recentIds,
    champions,
    skins,
    syncRunning,
    setPaletteOpen,
    setView,
    setSettingsOpen,
    setDetailSkinId,
    setStatsOpen,
    setShortcutsOpen,
    setUpdateInfo,
    showToast,
    selectChampion,
    selectSkin,
    setActiveFilter,
    sync,
  ]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    const node = document.querySelector<HTMLElement>('[data-cmd-active="true"]');
    node?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!paletteOpen) return null;

  const groups: Group[] = [
    "Son Bakılanlar",
    "Şampiyonlar",
    "Kostümler",
    "Eylemler",
  ];
  let cursor = -1;

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setPaletteOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (items.length === 0 ? 0 : (i + 1) % items.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) =>
        items.length === 0 ? 0 : (i - 1 + items.length) % items.length,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[active]?.run();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => setPaletteOpen(false)}
    >
      <div
        className="panel w-full max-w-xl animate-slideUp overflow-hidden !rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Şampiyon, kostüm veya komut ara..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
          />
          <kbd className="shrink-0 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
            ESC
          </kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto py-2">
          {items.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-slate-500">
              Sonuç bulunamadı
            </p>
          )}
          {groups.map((group) => {
            const groupItems = items.filter((i) => i.group === group);
            if (groupItems.length === 0) return null;
            return (
              <div key={group} className="mb-1">
                <p className="px-4 py-1 font-display text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                  {group}
                </p>
                {groupItems.map((item) => {
                  cursor += 1;
                  const index = cursor;
                  const isActive = index === active;
                  return (
                    <button
                      key={item.key}
                      data-cmd-active={isActive}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => item.run()}
                      className={clsx(
                        "flex w-full items-center gap-3 px-4 py-2 text-left transition",
                        isActive ? "bg-neon-cyan/10" : "hover:bg-white/5",
                      )}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-slate-200">
                          {item.label}
                        </span>
                        {item.hint && (
                          <span className="block truncate text-[11px] text-slate-500">
                            {item.hint}
                          </span>
                        )}
                      </span>
                      {isActive && (
                        <kbd className="shrink-0 rounded border border-white/10 bg-white/5 px-1 font-mono text-[9px] text-slate-400">
                          ↵
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 border-t border-white/10 px-4 py-2 text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Swords className="h-3 w-3" /> {skins.length} kostüm
          </span>
          <span className="ml-auto">↑↓ gezin</span>
          <span>↵ seç</span>
        </div>
      </div>
    </div>
  );
}
