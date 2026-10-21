import { create } from "zustand";

interface SelectionStore {
  active: boolean;
  ids: number[];
  toggleActive: () => void;
  setActive: (v: boolean) => void;
  toggle: (id: number) => void;
  selectMany: (ids: number[]) => void;
  clear: () => void;
}

export const useSelectionStore = create<SelectionStore>((set) => ({
  active: false,
  ids: [],
  toggleActive: () =>
    set((s) => ({ active: !s.active, ids: s.active ? [] : s.ids })),
  setActive: (active) => set((s) => ({ active, ids: active ? s.ids : [] })),
  toggle: (id) =>
    set((s) => ({
      ids: s.ids.includes(id)
        ? s.ids.filter((v) => v !== id)
        : [...s.ids, id],
    })),
  selectMany: (ids) => set({ ids }),
  clear: () => set({ ids: [] }),
}));
