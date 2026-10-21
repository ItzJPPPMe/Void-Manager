import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CollectionStore {
  favorites: number[];
  recent: number[];
  toggleFavorite: (skinId: number) => boolean;
  isFavorite: (skinId: number) => boolean;
  pushRecent: (skinId: number) => void;
  clearRecent: () => void;
  importCollection: (data: {
    favorites: number[];
    recent: number[];
  }) => { favorites: number; recent: number };
}

const RECENT_LIMIT = 20;

export const useCollectionStore = create<CollectionStore>()(
  persist(
    (set, get) => ({
      favorites: [],
      recent: [],
      toggleFavorite: (skinId) => {
        const has = get().favorites.includes(skinId);
        set((s) => ({
          favorites: has
            ? s.favorites.filter((id) => id !== skinId)
            : [skinId, ...s.favorites],
        }));
        return !has;
      },
      isFavorite: (skinId) => get().favorites.includes(skinId),
      pushRecent: (skinId) =>
        set((s) => ({
          recent: [skinId, ...s.recent.filter((id) => id !== skinId)].slice(
            0,
            RECENT_LIMIT,
          ),
        })),
      clearRecent: () => set({ recent: [] }),
      importCollection: ({ favorites, recent }) => {
        const uniqueFavorites = Array.from(new Set(favorites)).slice(0, 5000);
        const uniqueRecent = Array.from(new Set(recent)).slice(0, RECENT_LIMIT);
        set({ favorites: uniqueFavorites, recent: uniqueRecent });
        return {
          favorites: uniqueFavorites.length,
          recent: uniqueRecent.length,
        };
      },
    }),
    {
      name: "void-collection",
      version: 2,
      migrate: (persisted) => {
        const stored = (persisted ?? {}) as Partial<CollectionStore>;
        return {
          favorites: stored.favorites ?? [],
          recent: stored.recent ?? [],
        };
      },
    },
  ),
);
