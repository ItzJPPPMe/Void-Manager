import { create } from "zustand";
import type { LtkStatus, SystemStatus } from "@/services/ltkManager";
import { ltkManagerStatus } from "@/services/ltkManager";

type AppView = "library" | "settings" | "apply" | "logs";

interface AppStore {
  view: AppView;
  systemStatus: SystemStatus | null;
  ltkStatus: LtkStatus | null;
  settingsOpen: boolean;
  applyModalOpen: boolean;
  toast: { message: string; type: "success" | "error" | "info" } | null;
  setView: (v: AppView) => void;
  setSystemStatus: (s: SystemStatus | null) => void;
  setLtkStatus: (s: LtkStatus | null) => void;
  refreshLtk: () => Promise<LtkStatus | null>;
  setSettingsOpen: (v: boolean) => void;
  setApplyModalOpen: (v: boolean) => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  clearToast: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useAppStore = create<AppStore>((set) => ({
  view: "library",
  systemStatus: null,
  ltkStatus: null,
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
      return status;
    } catch {
      set({ ltkStatus: null });
      return null;
    }
  },
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
