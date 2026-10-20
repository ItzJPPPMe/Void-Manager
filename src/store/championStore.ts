import { create } from "zustand";
import type {
  ChampionSummary,
  Skin,
  SkinFilter,
  SkinSourceType,
} from "@/types/champion";
import type { CatalogSource } from "@/types/settings";

interface ChampionStore {
  champions: ChampionSummary[];
  skins: Skin[];
  selectedChampionId: number | null;
  selectedSkinId: number | null;
  selectedChromaId: number | null;
  searchQuery: string;
  championSearchQuery: string;
  activeFilter: SkinFilter;
  sourceFilter: SkinSourceType | "all";
  catalogSource: CatalogSource | null;
  loading: boolean;
  syncProgressText: string | null;
  setChampions: (champions: ChampionSummary[]) => void;
  setSkins: (skins: Skin[]) => void;
  selectChampion: (id: number | null) => void;
  selectSkin: (id: number) => void;
  selectChroma: (id: number | null) => void;
  setSearchQuery: (q: string) => void;
  setChampionSearchQuery: (q: string) => void;
  setActiveFilter: (f: SkinFilter) => void;
  setSourceFilter: (s: SkinSourceType | "all") => void;
  setCatalogSource: (s: CatalogSource | null) => void;
  setLoading: (v: boolean) => void;
  setSyncProgressText: (t: string | null) => void;
  toggleFavorite: (skinId: number) => void;
  markSkinReady: (skinId: number, packagePath: string | null) => void;
}

export const useChampionStore = create<ChampionStore>((set) => ({
  champions: [],
  skins: [],
  selectedChampionId: null,
  selectedSkinId: null,
  selectedChromaId: null,
  searchQuery: "",
  championSearchQuery: "",
  activeFilter: "all",
  sourceFilter: "all",
  catalogSource: null,
  loading: false,
  syncProgressText: null,
  setChampions: (champions) => set({ champions }),
  setSkins: (skins) =>
    set((s) => {
      const previous = new Map(s.skins.map((skin) => [skin.id, skin]));
      if (previous.size === 0) return { skins };
      return {
        skins: skins.map((skin) => {
          const old = previous.get(skin.id);
          if (!old) return skin;
          const packageUrl = skin.packageUrl ?? old.packageUrl;
          return {
            ...skin,
            favorite: old.favorite,
            packageUrl,
            ready: packageUrl ? old.ready || skin.ready : false,
          };
        }),
      };
    }),
  selectChampion: (id) =>
    set({
      selectedChampionId: id,
      selectedSkinId: null,
      selectedChromaId: null,
    }),
  selectSkin: (id) => set({ selectedSkinId: id, selectedChromaId: null }),
  selectChroma: (id) => set({ selectedChromaId: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setChampionSearchQuery: (q) => set({ championSearchQuery: q }),
  setActiveFilter: (f) => set({ activeFilter: f }),
  setSourceFilter: (s) => set({ sourceFilter: s }),
  setCatalogSource: (s) => set({ catalogSource: s }),
  setLoading: (v) => set({ loading: v }),
  setSyncProgressText: (t) => set({ syncProgressText: t }),
  toggleFavorite: (skinId) =>
    set((s) => ({
      skins: s.skins.map((skin) =>
        skin.id === skinId ? { ...skin, favorite: !skin.favorite } : skin,
      ),
    })),
  markSkinReady: (skinId, packagePath) =>
    set((s) => ({
      skins: s.skins.map((skin) =>
        skin.id === skinId
          ? {
              ...skin,
              ready: true,
              packageUrl: packagePath === null ? skin.packageUrl : packagePath,
            }
          : skin,
      ),
    })),
}));
