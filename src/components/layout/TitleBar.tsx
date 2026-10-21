import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Minus,
  Square,
  Copy,
  X,
  Search,
  ArrowUpCircle,
  Bell,
  Palette,
} from "lucide-react";
import clsx from "clsx";
import { useAppStore } from "@/store/appStore";
import { useNotificationStore } from "@/store/notificationStore";

export function TitleBar() {
  const view = useAppStore((s) => s.view);
  const setPaletteOpen = useAppStore((s) => s.setPaletteOpen);
  const setThemeEditorOpen = useAppStore((s) => s.setThemeEditorOpen);
  const updateInfo = useAppStore((s) => s.updateInfo);
  const unread = useNotificationStore((s) => s.unread);
  const setNotificationPanelOpen = useNotificationStore((s) => s.setPanelOpen);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const win = getCurrentWindow();
    let disposed = false;
    const sync = async () => {
      try {
        const value = await win.isMaximized();
        if (!disposed) setMaximized(value);
      } catch {
        if (!disposed) setMaximized(false);
      }
    };
    void sync();
    const unlisten = win.onResized(() => {
      void sync();
    });
    return () => {
      disposed = true;
      void unlisten.then((fn) => fn());
    };
  }, []);

  const win = getCurrentWindow();

  return (
    <header className="relative z-30 flex h-10 shrink-0 items-center gap-2 border-b border-white/5 bg-void-950/80 px-3 backdrop-blur-md select-none">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-neon-cyan/15 text-[10px] font-bold text-neon-cyan shadow-neon">
          V
        </span>
        <span className="font-display text-xs font-bold tracking-[0.18em] text-slate-200">
          VOID
        </span>
        <span className="text-[10px] uppercase tracking-widest text-slate-500">
          {view === "mods" ? "Modlar" : "Kostümler"}
        </span>
      </div>

      <div data-tauri-drag-region className="h-full min-w-4 flex-1" />

      <button
        onClick={() => setPaletteOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-400 transition hover:border-neon-cyan/40 hover:text-slate-200"
        title="Komut paleti"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Ara</span>
        <kbd className="rounded border border-white/10 bg-white/5 px-1 font-mono text-[9px] text-slate-500">
          Ctrl K
        </kbd>
      </button>

      {updateInfo && (
        <span
          className="flex items-center gap-1.5 rounded-lg border border-neon-lime/40 bg-neon-lime/10 px-2 py-1 text-[10px] font-semibold text-neon-lime"
          title={`Yeni sürüm: ${updateInfo.latest}`}
        >
          <ArrowUpCircle className="h-3.5 w-3.5" />
          v{updateInfo.latest}
        </span>
      )}

      <button
        onClick={() => setThemeEditorOpen(true)}
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-400 transition hover:border-neon-cyan/40 hover:text-neon-cyan"
        title="Tema editörü (Ctrl+Shift+T)"
        aria-label="Tema editörü"
      >
        <Palette className="h-3.5 w-3.5" />
      </button>

      <button
        onClick={() => setNotificationPanelOpen(true)}
        className="relative flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-400 transition hover:border-neon-cyan/40 hover:text-neon-cyan"
        title="Bildirim merkezi (N)"
        aria-label="Bildirim merkezi"
      >
        <Bell className="h-3.5 w-3.5" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-neon-magenta px-1 text-[9px] font-bold text-void-950">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <div className="ml-1 flex items-center">
        <button
          onClick={() => void win.minimize()}
          className="flex h-8 w-9 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
          title="Küçült"
          aria-label="Küçült"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          onClick={() => void win.toggleMaximize()}
          className="flex h-8 w-9 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
          title={maximized ? "Geri yükle" : "Büyüt"}
          aria-label={maximized ? "Geri yükle" : "Büyüt"}
        >
          {maximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={() => void win.close()}
          className={clsx(
            "flex h-8 w-9 items-center justify-center rounded-md text-slate-400 transition",
            "hover:bg-rose-500/80 hover:text-white",
          )}
          title="Kapat"
          aria-label="Kapat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
