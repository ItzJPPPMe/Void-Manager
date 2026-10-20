import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TitleBar } from "@/components/layout/TitleBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { StatusBar } from "@/components/layout/StatusBar";
import { ChampionWorkspace } from "@/components/champion/ChampionWorkspace";
import { ModsView } from "@/components/mods/ModsView";
import { SelectedSkinPanel } from "@/components/panel/SelectedSkinPanel";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { SkinDetailModal } from "@/components/skins/SkinDetailModal";
import { ChampionGalleryModal } from "@/components/skins/ChampionGalleryModal";
import { StatsModal } from "@/components/modals/StatsModal";
import { ShortcutsModal } from "@/components/modals/ShortcutsModal";
import { Toast } from "@/components/layout/Toast";
import { useAppStore } from "@/store/appStore";
import { useChampionStore } from "@/store/championStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useRepositories } from "@/hooks/useRepositories";
import { checkForUpdate } from "@/services/updateService";

export default function App() {
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const statsOpen = useAppStore((s) => s.statsOpen);
  const shortcutsOpen = useAppStore((s) => s.shortcutsOpen);
  const view = useAppStore((s) => s.view);
  const setSystemStatus = useAppStore((s) => s.setSystemStatus);
  const refreshLtk = useAppStore((s) => s.refreshLtk);
  const refreshLibrary = useAppStore((s) => s.refreshLibrary);
  const setUpdateInfo = useAppStore((s) => s.setUpdateInfo);
  const autoSyncOnLaunch = useSettingsStore((s) => s.settings.autoSyncOnLaunch);
  const lastSyncedAt = useSettingsStore((s) => s.sync.lastSyncedAt);
  const themeAccent = useSettingsStore((s) => s.settings.themeAccent);
  const checkUpdateOnLaunch = useSettingsStore(
    (s) => s.settings.checkUpdateOnLaunch,
  );
  const { sync } = useRepositories();

  useEffect(() => {
    document.documentElement.dataset.accent = themeAccent;
  }, [themeAccent]);

  useEffect(() => {
    if (!checkUpdateOnLaunch) return;
    void checkForUpdate()
      .then((info) => setUpdateInfo(info))
      .catch(() => undefined);
  }, [checkUpdateOnLaunch, setUpdateInfo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const app = useAppStore.getState();
      const champ = useChampionStore.getState();
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        app.setPaletteOpen(!app.paletteOpen);
        return;
      }
      if (mod && e.key === ",") {
        e.preventDefault();
        app.setSettingsOpen(true);
        return;
      }
      if (mod && (e.key === "1" || e.key === "2")) {
        e.preventDefault();
        app.setView(e.key === "1" ? "skins" : "mods");
        return;
      }
      if (typing || mod || e.altKey) return;
      const modalOpen =
        app.paletteOpen ||
        app.settingsOpen ||
        app.statsOpen ||
        app.shortcutsOpen ||
        app.galleryChampionId !== null ||
        app.detailSkinId !== null;
      if (modalOpen) return;
      if (e.key === "?") {
        app.setShortcutsOpen(true);
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        document
          .querySelector<HTMLInputElement>('input[placeholder*="şampiyonlar"]')
          ?.focus();
        return;
      }
      if (e.key.toLowerCase() === "f" && champ.selectedSkinId !== null) {
        champ.toggleFavorite(champ.selectedSkinId);
        return;
      }
      if (e.key.toLowerCase() === "g" && champ.selectedChampionId !== null) {
        app.setView("skins");
        app.setGalleryChampionId(champ.selectedChampionId);
        return;
      }
      if (e.key.toLowerCase() === "r" && champ.skins.length > 0) {
        const pick = champ.skins[Math.floor(Math.random() * champ.skins.length)];
        app.setView("skins");
        champ.selectChampion(pick.championId);
        champ.selectSkin(pick.id);
        app.setDetailSkinId(pick.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-void-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(0,240,255,0.07),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.08),transparent_55%)]" />
      <TitleBar />
      <div className="relative z-10 flex min-h-0 flex-1">
        <Sidebar />
        <main className="relative z-10 flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
            {view === "mods" ? <ModsView /> : <ChampionWorkspace />}
          </div>
          {view === "skins" && <SelectedSkinPanel />}
          <StatusBar />
        </main>
      </div>
      {settingsOpen && <SettingsPanel />}
      <CommandPalette />
      <SkinDetailModal />
      <ChampionGalleryModal />
      {statsOpen && <StatsModal />}
      {shortcutsOpen && <ShortcutsModal />}
      <Toast />
    </div>
  );
}
