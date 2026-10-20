import { create } from "zustand";
import type {
  ChampionSummary,
  Skin,
  SkinFilter,
  SkinSourceType,
} from "@/types/champion";
import type { CatalogSource } from "@/types/settings";
import { useCollectionStore } from "@/store/collectionStore";

export type SkinSort = "default" | "name" | "rarity" | "champion" | "id";
export type RarityFilter =
  | "all"
  | "kUltimate"
  | "kExalted"
  | "kMythic"
  | "kTranscendent"
  | "kLegendary"
  | "kEpic"
  | "kRare";

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
  rarityFilter: RarityFilter;
  sortMode: SkinSort;
  onlyWithPackage: boolean;
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
  setRarityFilter: (r: RarityFilter) => void;
  setSortMode: (s: SkinSort) => void;
  setOnlyWithPackage: (v: boolean) => void;
  setCatalogSource: (s: CatalogSource | null) => void;
  setLoading: (v: boolean) => void;
  setSyncProgressText: (t: string | null) => void;
  toggleFavorite: (skinId: number) => void;
  markSkinReady: (skinId: number, packagePath: string | null) => void;
  rehydrateFavorites: () => void;
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
  rarityFilter: "all",
  sortMode: "default",
  onlyWithPackage: false,
  catalogSource: null,
  loading: false,
  syncProgressText: null,
  setChampions: (champions) => set({ champions }),
  setSkins: (skins) =>
    set((s) => {
      const previous = new Map(s.skins.map((skin) => [skin.id, skin]));
      const favorites = new Set(useCollectionStore.getState().favorites);
      return {
        skins: skins.map((skin) => {
          const favorite = favorites.has(skin.id);
          const old = previous.get(skin.id);
          if (!old) return { ...skin, favorite };
          const packageUrl = skin.packageUrl ?? old.packageUrl;
          return {
            ...skin,
            favorite,
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
  selectSkin: (id) => {
    useCollectionStore.getState().pushRecent(id);
    set({ selectedSkinId: id, selectedChromaId: null });
  },
  selectChroma: (id) => set({ selectedChromaId: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setChampionSearchQuery: (q) => set({ championSearchQuery: q }),
  setActiveFilter: (f) => set({ activeFilter: f }),
  setSourceFilter: (s) => set({ sourceFilter: s }),
  setRarityFilter: (r) => set({ rarityFilter: r }),
  setSortMode: (s) => set({ sortMode: s }),
  setOnlyWithPackage: (v) => set({ onlyWithPackage: v }),
  setCatalogSource: (s) => set({ catalogSource: s }),
  setLoading: (v) => set({ loading: v }),
  setSyncProgressText: (t) => set({ syncProgressText: t }),
  toggleFavorite: (skinId) => {
    const favorite = useCollectionStore.getState().toggleFavorite(skinId);
    set((s) => ({
      skins: s.skins.map((skin) =>
        skin.id === skinId ? { ...skin, favorite } : skin,
      ),
    }));
  },
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
  rehydrateFavorites: () =>
    set((s) => {
      const favorites = new Set(useCollectionStore.getState().favorites);
      return {
        skins: s.skins.map((skin) => ({
          ...skin,
          favorite: favorites.has(skin.id),
        })),
      };
    }),
}));
