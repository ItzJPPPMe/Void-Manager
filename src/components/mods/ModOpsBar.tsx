import { useCallback, useEffect, useState } from "react";
import { save, open } from "@tauri-apps/plugin-dialog";
import {
  Archive,
  Download,
  History,
  Power,
  PowerOff,
  RotateCcw,
  Trash2,
  Loader2,
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import {
  ltkBackupLibrary,
  ltkListBackups,
  ltkRestoreLibrary,
  ltkSetModsBulk,
  type LibraryBackup,
  type LtkLibrary,
} from "@/services/ltkManager";

interface ModOpsBarProps {
  library: LtkLibrary | null;
}

export function ModOpsBar({ library }: ModOpsBarProps) {
  const showToast = useAppStore((s) => s.showToast);
  const setLibrary = useAppStore((s) => s.setLibrary);
  const [busy, setBusy] = useState<string | null>(null);
  const [backups, setBackups] = useState<LibraryBackup[]>([]);
  const [showBackups, setShowBackups] = useState(false);

  const loadBackups = useCallback(async () => {
    try {
      const list = await ltkListBackups();
      setBackups(list);
    } catch {
      setBackups([]);
    }
  }, []);

  useEffect(() => {
    void loadBackups();
  }, [loadBackups]);

  const mods = library?.mods ?? [];

  const bulk = async (enabled: boolean) => {
    const ids = mods.map((m) => m.id);
    if (ids.length === 0) {
      showToast("Önce mod yükle", "error");
      return;
    }
    setBusy(enabled ? "enable" : "disable");
    try {
      const next = await ltkSetModsBulk(ids, enabled);
      setLibrary(next);
      showToast(
        `${ids.length} mod ${enabled ? "etkinleştirildi" : "devre dışı bırakıldı"}`,
        "success",
      );
    } catch (e) {
      showToast(typeof e === "string" ? e : "Toplu işlem başarısız", "error");
    } finally {
      setBusy(null);
    }
  };

  const backup = async () => {
    setBusy("backup");
    try {
      const target = await save({
        title: "LTK kütüphane yedeği",
        defaultPath: `void-ltk-yedek-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!target) return;
      await ltkBackupLibrary(target);
      showToast("Yedek oluşturuldu", "success");
      void loadBackups();
    } catch (e) {
      showToast(typeof e === "string" ? e : "Yedek oluşturulamadı", "error");
    } finally {
      setBusy(null);
    }
  };

  const restore = async (path: string) => {
    setBusy("restore");
    try {
      const next = await ltkRestoreLibrary(path);
      setLibrary(next);
      showToast("Yedek geri yüklendi", "success");
      setShowBackups(false);
    } catch (e) {
      showToast(typeof e === "string" ? e : "Yedek geri yüklenemedi", "error");
    } finally {
      setBusy(null);
    }
  };

  const restoreFromFile = async () => {
    setBusy("restore");
    try {
      const picked = await open({
        title: "Yedek dosyası seç",
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!picked || Array.isArray(picked)) return;
      const next = await ltkRestoreLibrary(picked);
      setLibrary(next);
      showToast("Yedek geri yüklendi", "success");
    } catch (e) {
      showToast(typeof e === "string" ? e : "Yedek geri yüklenemedi", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mb-5 rounded-2xl border border-white/10 bg-void-800/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-1 flex items-center gap-2">
          <Power className="h-4 w-4 text-neon-violet" />
          <h3 className="font-display text-sm font-bold uppercase tracking-widest text-neon-violet/90">
            Toplu İşlemler
          </h3>
        </div>

        <button
          onClick={() => void bulk(true)}
          disabled={busy !== null || mods.length === 0}
          className="btn-ghost !py-1.5 disabled:opacity-40"
        >
          {busy === "enable" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Power className="h-3.5 w-3.5 text-neon-lime" />
          )}
          Tümünü Etkinleştir
        </button>

        <button
          onClick={() => void bulk(false)}
          disabled={busy !== null || mods.length === 0}
          className="btn-ghost !py-1.5 disabled:opacity-40"
        >
          {busy === "disable" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <PowerOff className="h-3.5 w-3.5 text-rose-400" />
          )}
          Tümünü Kapat
        </button>

        <span className="mx-1 h-5 w-px bg-white/10" />

        <button
          onClick={() => void backup()}
          disabled={busy !== null}
          className="btn-ghost !py-1.5 disabled:opacity-40"
        >
          {busy === "backup" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5 text-neon-cyan" />
          )}
          Yedek Al
        </button>

        <button
          onClick={() => {
            setShowBackups((v) => !v);
            void loadBackups();
          }}
          disabled={busy !== null}
          className="btn-ghost !py-1.5 disabled:opacity-40"
        >
          <History className="h-3.5 w-3.5 text-neon-amber" />
          Yedekler
        </button>

        <button
          onClick={() => void restoreFromFile()}
          disabled={busy !== null}
          className="btn-ghost !py-1.5 disabled:opacity-40"
        >
          {busy === "restore" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5 text-neon-cyan" />
          )}
          Geri Yükle
        </button>
      </div>

      {showBackups && (
        <div className="animate-reveal-up mt-3 space-y-1.5">
          {backups.length === 0 ? (
            <p className="text-xs text-slate-600">Kayıtlı yedek bulunamadı.</p>
          ) : (
            backups.map((item) => (
              <div
                key={item.path}
                className="flex items-center gap-3 rounded-lg bg-void-900/50 px-3 py-2"
              >
                <Archive className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-slate-200">{item.name}</p>
                  <p className="text-[10px] text-slate-600">
                    {item.sizeKb} KB ·{" "}
                    {new Date(item.createdAt).toLocaleString("tr-TR")}
                  </p>
                </div>
                <button
                  onClick={() => void restore(item.path)}
                  disabled={busy !== null}
                  className="btn-ghost !px-2 !py-1 !text-[11px] disabled:opacity-40"
                >
                  <RotateCcw className="h-3 w-3" /> Geri yükle
                </button>
                <button
                  onClick={() => {
                    setLibrary(null);
                    showToast("Yedek listesi temizlendi", "info");
                  }}
                  className="text-slate-600 transition hover:text-rose-300"
                  title="Listeyi temizle"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
