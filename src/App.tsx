import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Sidebar } from "@/components/layout/Sidebar";
import { StatusBar } from "@/components/layout/StatusBar";
import { ChampionWorkspace } from "@/components/champion/ChampionWorkspace";
import { ModsView } from "@/components/mods/ModsView";
import { SelectedSkinPanel } from "@/components/panel/SelectedSkinPanel";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { Toast } from "@/components/layout/Toast";
import { useAppStore } from "@/store/appStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useRepositories } from "@/hooks/useRepositories";

export default function App() {
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const view = useAppStore((s) => s.view);
  const setSystemStatus = useAppStore((s) => s.setSystemStatus);
  const refreshLtk = useAppStore((s) => s.refreshLtk);
  const refreshLibrary = useAppStore((s) => s.refreshLibrary);
  const autoSyncOnLaunch = useSettingsStore((s) => s.settings.autoSyncOnLaunch);
  const lastSyncedAt = useSettingsStore((s) => s.sync.lastSyncedAt);
  const { sync } = useRepositories();

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const status = await invoke<
          import("@/services/ltkManager").SystemStatus
        >("get_system_status");
        if (!cancelled) setSystemStatus(status);
      } catch {
        if (!cancelled) setSystemStatus(null);
      }
      if (!cancelled) void refreshLtk();
    };
    void refresh();
    const timer = setInterval(refresh, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [setSystemStatus, refreshLtk]);

  useEffect(() => {
    void refreshLibrary();
  }, [refreshLibrary]);

  useEffect(() => {
    if (autoSyncOnLaunch && !lastSyncedAt) {
      void sync();
    }
  }, [autoSyncOnLaunch, lastSyncedAt, sync]);

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-void-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(0,240,255,0.07),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.08),transparent_55%)]" />
      <Sidebar />
      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
          {view === "mods" ? <ModsView /> : <ChampionWorkspace />}
        </div>
        {view === "skins" && <SelectedSkinPanel />}
        <StatusBar />
      </main>
      {settingsOpen && <SettingsPanel />}
      <Toast />
    </div>
  );
}
