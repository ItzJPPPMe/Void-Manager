import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NotificationKind = "success" | "error" | "info" | "warning";

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  createdAt: number;
  read: boolean;
}

interface NotificationStore {
  items: Notification[];
  panelOpen: boolean;
  unread: number;
  push: (kind: NotificationKind, title: string, message: string) => void;
  dismiss: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  setPanelOpen: (v: boolean) => void;
}

const LIMIT = 60;

let counter = 0;

function makeId(): string {
  counter += 1;
  return `n${Date.now().toString(36)}${counter.toString(36)}`;
}

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set, get) => ({
      items: [],
      panelOpen: false,
      unread: 0,
      push: (kind, title, message) =>
        set((s) => {
          const item: Notification = {
            id: makeId(),
            kind,
            title,
            message,
            createdAt: Date.now(),
            read: false,
          };
          const items = [item, ...s.items].slice(0, LIMIT);
          return {
            items,
            unread: s.unread + 1,
          };
        }),
      dismiss: (id) =>
        set((s) => ({
          items: s.items.filter((n) => n.id !== id),
          unread: Math.max(0, s.unread - (s.items.find((n) => n.id === id)?.read ? 0 : 1)),
        })),
      markAllRead: () =>
        set((s) => ({
          items: s.items.map((n) => ({ ...n, read: true })),
          unread: 0,
        })),
      clearAll: () => set({ items: [], unread: 0 }),
      setPanelOpen: (panelOpen) => {
        if (panelOpen && get().unread > 0) {
          set((s) => ({
            panelOpen,
            unread: 0,
            items: s.items.map((n) => ({ ...n, read: true })),
          }));
          return;
        }
        set({ panelOpen });
      },
    }),
    {
      name: "void-notifications",
      version: 1,
      partialize: (s) => ({ items: s.items.slice(0, 40) }),
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<NotificationStore>;
        const items = (stored.items ?? []).map((n) => ({ ...n, read: true }));
        return { ...current, ...stored, items, unread: 0, panelOpen: false };
      },
    },
  ),
);
