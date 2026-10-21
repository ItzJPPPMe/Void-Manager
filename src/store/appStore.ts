import { create } from "zustand";
import type {
  LtkLibrary,
  LtkPatcherConfig,
  LtkStatus,
  SystemStatus,
} from "@/services/ltkManager";
import { ltkManagerStatus, ltkPatcherConfig, ltkLibrary } from "@/services/ltkManager";
import { useNotificationStore } from "@/store/notificationStore";

type AppView = "skins" | "mods";

export interface UpdateInfo {
  latest: string;
  url: string;
  notes: string;
}

interface AppStore {
  view: AppView;
  systemStatus: SystemStatus | null;
  ltkStatus: LtkStatus | null;
  library: LtkLibrary | null;
  libraryError: string | null;
  libraryLoading: boolean;
  patcher: LtkPatcherConfig | null;
  settingsOpen: boolean;
  applyModalOpen: boolean;
  paletteOpen: boolean;
  detailSkinId: number | null;
  galleryChampionId: number | null;
  cinematicSkinId: number | null;
  statsOpen: boolean;
  shortcutsOpen: boolean;
  dashboardOpen: boolean;
  rouletteOpen: boolean;
  themeEditorOpen: boolean;
  libraryExplorerOpen: boolean;
  updateInfo: UpdateInfo | null;
  toast: { message: string; type: "success" | "error" | "info" } | null;
  setView: (v: AppView) => void;
  setSystemStatus: (s: SystemStatus | null) => void;
  setLtkStatus: (s: LtkStatus | null) => void;
  refreshLtk: () => Promise<LtkStatus | null>;
  refreshLibrary: () => Promise<void>;
  setPatcher: (p: LtkPatcherConfig | null) => void;
  setLibrary: (l: LtkLibrary | null) => void;
  setSettingsOpen: (v: boolean) => void;
  setApplyModalOpen: (v: boolean) => void;
  setPaletteOpen: (v: boolean) => void;
  setDetailSkinId: (id: number | null) => void;
  setGalleryChampionId: (id: number | null) => void;
  setCinematicSkinId: (id: number | null) => void;
  setStatsOpen: (v: boolean) => void;
  setShortcutsOpen: (v: boolean) => void;
  setDashboardOpen: (v: boolean) => void;
  setRouletteOpen: (v: boolean) => void;
  setThemeEditorOpen: (v: boolean) => void;
  setLibraryExplorerOpen: (v: boolean) => void;
  setUpdateInfo: (u: UpdateInfo | null) => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  notify: (
    kind: "success" | "error" | "info" | "warning",
    title: string,
    message: string,
  ) => void;
  clearToast: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useAppStore = create<AppStore>((set) => ({
  view: "skins",
  systemStatus: null,
  ltkStatus: null,
  library: null,
  libraryError: null,
  libraryLoading: false,
  patcher: null,
  settingsOpen: false,
  applyModalOpen: false,
  paletteOpen: false,
  detailSkinId: null,
  galleryChampionId: null,
  cinematicSkinId: null,
  statsOpen: false,
  shortcutsOpen: false,
  dashboardOpen: false,
  rouletteOpen: false,
  themeEditorOpen: false,
  libraryExplorerOpen: false,
  updateInfo: null,
  toast: null,
  setView: (view) => set({ view }),
  setSystemStatus: (systemStatus) => set({ systemStatus }),
  setLtkStatus: (ltkStatus) => set({ ltkStatus }),
  refreshLtk: async () => {
    try {
      const status = await ltkManagerStatus();
      set({ ltkStatus: status });
      try {
        const patcher = await ltkPatcherConfig();
        set({ patcher });
      } catch {
        set({ patcher: null });
      }
      return status;
    } catch {
      set({ ltkStatus: null });
      return null;
    }
  },
  refreshLibrary: async () => {
    set({ libraryLoading: true });
    try {
      const library = await ltkLibrary();
      set({ library, libraryError: null, libraryLoading: false });
    } catch (e) {
      set({
        library: null,
        libraryError: typeof e === "string" ? e : "LTK kütüphanesi okunamadı",
        libraryLoading: false,
      });
    }
  },
  setPatcher: (patcher) => set({ patcher }),
  setLibrary: (library) => set({ library }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setApplyModalOpen: (applyModalOpen) => set({ applyModalOpen }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setDetailSkinId: (detailSkinId) => set({ detailSkinId }),
  setGalleryChampionId: (galleryChampionId) => set({ galleryChampionId }),
  setCinematicSkinId: (cinematicSkinId) => set({ cinematicSkinId }),
  setStatsOpen: (statsOpen) => set({ statsOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  setDashboardOpen: (dashboardOpen) => set({ dashboardOpen }),
  setRouletteOpen: (rouletteOpen) => set({ rouletteOpen }),
  setThemeEditorOpen: (themeEditorOpen) => set({ themeEditorOpen }),
  setLibraryExplorerOpen: (libraryExplorerOpen) =>
    set({ libraryExplorerOpen }),
  setUpdateInfo: (updateInfo) => set({ updateInfo }),
  showToast: (message, type = "info") => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: { message, type } });
    toastTimer = setTimeout(() => set({ toast: null }), 4200);
    const titles = {
      success: "İşlem tamamlandı",
      error: "Hata oluştu",
      info: "Bilgi",
    } as const;
    useNotificationStore
      .getState()
      .push(type, titles[type], message);
  },
  notify: (kind, title, message) => {
    useNotificationStore.getState().push(kind, title, message);
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: { message: title, type: kind === "warning" ? "info" : kind } });
    toastTimer = setTimeout(() => set({ toast: null }), 4200);
  },
  clearToast: () => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: null });
  },
}));
