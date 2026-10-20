import { X, Keyboard } from "lucide-react";
import { useAppStore } from "@/store/appStore";

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "Ctrl + K", label: "Komut paletini aç" },
  { keys: "Ctrl + ,", label: "Ayarları aç" },
  { keys: "Ctrl + 1", label: "Kostümler görünümü" },
  { keys: "Ctrl + 2", label: "Modlar görünümü" },
  { keys: "F", label: "Seçili kostümü favorile" },
  { keys: "R", label: "Rastgele kostüm seç" },
  { keys: "G", label: "Seçili şampiyonun galerisini aç" },
  { keys: "← →", label: "Kostümler arasında gezin" },
  { keys: "/", label: "Aramaya odaklan" },
  { keys: "Esc", label: "Açık pencereyi kapat" },
  { keys: "?", label: "Bu pencereyi aç" },
];

export function ShortcutsModal() {
  const setShortcutsOpen = useAppStore((s) => s.setShortcutsOpen);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
      onClick={() => setShortcutsOpen(false)}
    >
      <div
        className="panel w-full max-w-md animate-slideUp overflow-hidden !rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-neon-cyan" />
            <h2 className="font-display text-lg font-bold tracking-wide">
              Klavye Kısayolları
            </h2>
          </div>
          <button
            onClick={() => setShortcutsOpen(false)}
            className="btn-ghost !px-2.5"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="divide-y divide-white/5">
          {SHORTCUTS.map((s) => (
            <div
              key={s.keys}
              className="flex items-center justify-between px-5 py-2.5"
            >
              <span className="text-sm text-slate-300">{s.label}</span>
              <kbd className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-slate-400">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
