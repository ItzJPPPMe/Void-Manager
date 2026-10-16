import { create } from "zustand";
import type {
  LtkLibrary,
  LtkPatcherConfig,
  LtkStatus,
  SystemStatus,
} from "@/services/ltkManager";
import { ltkManagerStatus, ltkPatcherConfig, ltkLibrary } from "@/services/ltkManager";

type AppView = "skins" | "mods";

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
  toast: { message: string; type: "success" | "error" | "info" } | null;
  setView: (v: AppView) => void;
  setSystemStatus: (s: SystemStatus | null) => void;
  setLtkStatus: (s: LtkStatus | null) => void;
  refreshLtk: () => Promise<LtkStatus | null>;
  refreshLibrary: () => Promise<void>;
  setPatcher: (p: LtkPatcherConfig | null) => void;
  setSettingsOpen: (v: boolean) => void;
  setApplyModalOpen: (v: boolean) => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
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
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setApplyModalOpen: (applyModalOpen) => set({ applyModalOpen }),
  showToast: (message, type = "info") => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: { message, type } });
    toastTimer = setTimeout(() => set({ toast: null }), 4200);
  },
  clearToast: () => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: null });
  },
}));
