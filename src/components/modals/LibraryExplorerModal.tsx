import { useCallback, useEffect, useState } from "react";
import {
  X,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronUp,
  HardDrive,
  Loader2,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import clsx from "clsx";
import { useAppStore } from "@/store/appStore";
import {
  listDirEntries,
  openFolder,
  type DirEntryInfo,
} from "@/services/ltkManager";

export function LibraryExplorerModal() {
  const showToast = useAppStore((s) => s.showToast);
  const libraryDir = useAppStore((s) => s.library?.dir ?? null);
  const [root, setRoot] = useState<string | null>(null);
  const [cwd, setCwd] = useState<string | null>(null);
  const [entries, setEntries] = useState<DirEntryInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const list = await listDirEntries(path);
      setEntries(list);
      setCwd(path);
    } catch (e) {
      setEntries([]);
      setError(typeof e === "string" ? e : "Klasör okunamadı");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!root) return;
    void load(root);
  }, [root, load]);

  const navigate = (path: string) => {
    void load(path);
  };

  const goUp = () => {
    setRoot(null);
    setCwd(null);
    setEntries([]);
  };

  const handleOpen = async (entry: DirEntryInfo) => {
    if (entry.isDir) {
      navigate(entry.path);
      return;
    }
    try {
      await openFolder(entry.path);
    } catch (e) {
      showToast(typeof e === "string" ? e : "Dosya açılamadı", "error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
      onClick={() => setRoot(null)}
    >
      <div
        className="panel flex h-full max-h-[80vh] w-full max-w-2xl animate-slideUp flex-col overflow-hidden !rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-neon-violet" />
            <h2 className="font-display text-lg font-bold tracking-wide">
              LTK Kütüphane Gezgini
            </h2>
          </div>
          <button
            onClick={() => setRoot(null)}
            className="btn-ghost !px-2.5"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {!root ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <FolderOpen className="h-10 w-10 text-slate-600" />
            <p className="text-sm text-slate-400">
              LTK kütüphane klasörünü açarak içerikleri inceleyin.
            </p>
            <button
              onClick={() => {
                if (!libraryDir) {
                  showToast(
                    "LTK kütüphanesi henüz bulunamadı. Önce LTK Manager'ı çalıştırın.",
                    "error",
                  );
                  return;
                }
                setRoot(libraryDir);
              }}
              className="btn-primary"
            >
              <FolderOpen className="h-4 w-4" />
              Kütüphaneyi Aç
            </button>
            <p className="max-w-sm break-all text-[11px] leading-relaxed text-slate-600">
              {libraryDir ??
                "Kütüphane genelde %APPDATA%\\dev.leaguetoolkit.manager konumunda bulunur."}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-white/5 px-5 py-3">
              <button
                onClick={goUp}
                className="btn-ghost !px-2 !py-1.5"
                title="Üst klasör"
                aria-label="Üst klasör"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1 truncate rounded-lg bg-void-900/60 px-3 py-1.5 font-mono text-[11px] text-slate-400">
                {cwd ?? "—"}
              </div>
              <button
                onClick={() => cwd && void load(cwd)}
                className="btn-ghost !px-2 !py-1.5"
                title="Yenile"
                aria-label="Yenile"
              >
                <RefreshCw
                  className={clsx("h-4 w-4", loading && "animate-spin")}
                />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {loading && (
                <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Okunuyor...
                </div>
              )}

              {error && (
                <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
                  {error}
                </p>
              )}

              {!loading && !error && entries.length === 0 && (
                <p className="py-10 text-center text-xs text-slate-600">
                  Bu klasör boş.
                </p>
              )}

              <div className="space-y-1">
                {entries.map((entry) => (
                  <button
                    key={entry.path}
                    onClick={() => void handleOpen(entry)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-white/5"
                  >
                    {entry.isDir ? (
                      <FolderOpen className="h-4 w-4 shrink-0 text-neon-violet" />
                    ) : (
                      <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-200">
                      {entry.name}
                    </span>
                    {!entry.isDir && (
                      <span className="shrink-0 font-mono text-[10px] text-slate-600">
                        {entry.sizeKb} KB
                      </span>
                    )}
                    {entry.isDir ? (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                    ) : (
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
