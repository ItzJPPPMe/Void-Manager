import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_REPOSITORIES,
  DEFAULT_SETTINGS,
  type AppSettings,
  type RepositoryConfig,
  type SyncState,
  type ThemeAccent,
} from "@/types/settings";

interface SettingsStore {
  settings: AppSettings;
  repositories: RepositoryConfig[];
  sync: SyncState;
  update: (patch: Partial<AppSettings>) => void;
  toggleRepository: (id: AppSettings["activeRepositories"][number]) => void;
  setAccent: (accent: ThemeAccent) => void;
  setRepositories: (repos: RepositoryConfig[]) => void;
  setSyncState: (patch: Partial<SyncState>) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      repositories: DEFAULT_REPOSITORIES,
      sync: {
        running: false,
        lastSyncedAt: null,
        errors: [],
      },
      update: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
      toggleRepository: (id) =>
        set((s) => {
          const active = s.settings.activeRepositories.includes(id)
            ? s.settings.activeRepositories.filter((r) => r !== id)
            : [...s.settings.activeRepositories, id];
          return {
            settings: { ...s.settings, activeRepositories: active },
            repositories: s.repositories.map((r) =>
              r.id === id ? { ...r, enabled: active.includes(id) } : r,
            ),
          };
        }),
      setAccent: (accent) =>
        set((s) => ({ settings: { ...s.settings, themeAccent: accent } })),
      setRepositories: (repositories) => set({ repositories }),
      setSyncState: (patch) =>
        set((s) => ({ sync: { ...s.sync, ...patch } })),
    }),
    {
      name: "void-settings",
      version: 3,
      partialize: (s) => ({
        settings: s.settings,
        repositories: s.repositories,
      }),
      migrate: (persisted) => {
        const stored = (persisted ?? {}) as Partial<SettingsStore>;
        return {
          ...stored,
          settings: {
            ...DEFAULT_SETTINGS,
            ...(stored.settings ?? {}),
            gridDensity: DEFAULT_SETTINGS.gridDensity,
          },
          repositories: stored.repositories ?? DEFAULT_REPOSITORIES,
        };
      },
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<SettingsStore>;
        const settings: AppSettings = {
          ...current.settings,
          ...(stored.settings ?? {}),
        };
        return {
          ...current,
          ...stored,
          settings,
          sync: current.sync,
          repositories: current.repositories.map((repo) => ({
            ...repo,
            enabled: settings.activeRepositories.includes(repo.id),
          })),
        };
      },
    },
  ),
);
