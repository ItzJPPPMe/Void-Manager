import { useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Package,
  RefreshCw,
  Upload,
  Power,
  ShieldCheck,
  ShieldAlert,
  Play,
  User,
  Tag,
  FolderOpen,
  Cpu,
} from "lucide-react";
import clsx from "clsx";
import { useAppStore } from "@/store/appStore";
import {
  ltkImportFile,
  ltkLaunch,
  ltkOpen,
  ltkSetAutostart,
  ltkSetPatcherFlags,
  type LtkMod,
} from "@/services/ltkManager";

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={clsx(
        "relative h-5 w-9 shrink-0 rounded-full transition",
        checked ? "bg-neon-violet/80" : "bg-white/10",
        disabled && "opacity-40",
      )}
    >
      <span
        className={clsx(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
          checked ? "left-4" : "left-0.5",
        )}
      />
    </button>
  );
}

function ModCard({ mod }: { mod: LtkMod }) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-void-800/60 p-4 transition hover:border-neon-violet/40">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-neon-violet/30 to-neon-cyan/20">
          <Package className="h-5 w-5 text-neon-violet" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-sm font-bold tracking-wide text-slate-100">
              {mod.name}
            </h3>
            {mod.enabled ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded bg-neon-lime/15 px-1.5 py-0.5 text-[10px] font-semibold text-neon-lime">
                Etkin
              </span>
            ) : (
              <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                Pasif
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
            {mod.version && <span>v{mod.version}</span>}
            {mod.format && (
              <span className="uppercase tracking-wide">.{mod.format}</span>
            )}
            {mod.folder && (
              <span className="inline-flex items-center gap-1">
                <FolderOpen className="h-3 w-3" />
                {mod.folder}
              </span>
            )}
          </div>
        </div>
      </div>

      {mod.description && (
        <p className="line-clamp-2 text-xs leading-relaxed text-slate-400">
          {mod.description}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2">
        {mod.authors.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
            <User className="h-3 w-3" />
            {mod.authors.join(", ")}
          </span>
        )}
        {mod.champions.slice(0, 2).map((champ) => (
          <span
            key={champ}
            className="inline-flex items-center gap-1 rounded-md bg-neon-cyan/10 px-2 py-0.5 text-[10px] text-neon-cyan"
          >
            <Tag className="h-3 w-3" />
            {champ}
          </span>
        ))}
      </div>
    </article>
  );
}

export function ModsView() {
  const library = useAppStore((s) => s.library);
  const libraryError = useAppStore((s) => s.libraryError);
  const loading = useAppStore((s) => s.libraryLoading);
  const refreshLibrary = useAppStore((s) => s.refreshLibrary);
  const refreshLtk = useAppStore((s) => s.refreshLtk);
  const ltkStatus = useAppStore((s) => s.ltkStatus);
  const patcher = useAppStore((s) => s.patcher);
  const setPatcher = useAppStore((s) => s.setPatcher);
  const showToast = useAppStore((s) => s.showToast);
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState(false);
  const [busyFlag, setBusyFlag] = useState<"autostart" | "flags" | null>(null);

  const mods = useMemo(() => {
    const list = library?.mods ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.description?.toLowerCase().includes(q) ?? false) ||
        m.authors.some((a) => a.toLowerCase().includes(q)) ||
        m.champions.some((c) => c.toLowerCase().includes(q)),
    );
  }, [library, query]);

  const enabledCount = library?.mods.filter((m) => m.enabled).length ?? 0;

  const handleImport = async () => {
    try {
      const picked = await open({
        multiple: true,
        title: "Mod paketi seç (.fantome / .modpkg / .zip)",
        filters: [
          { name: "Mod paketleri", extensions: ["fantome", "modpkg", "zip"] },
        ],
      });
      if (!picked) return;
      const paths = Array.isArray(picked) ? picked : [picked];
      if (paths.length === 0) return;
      setImporting(true);
      for (const path of paths) {
        await ltkImportFile(path);
      }
      showToast(
        `${paths.length} paket LTK'ya gönderildi. Kurulum birkaç saniye sürebilir.`,
        "success",
      );
      setTimeout(() => {
        void refreshLibrary();
        void refreshLtk();
      }, 4000);
    } catch (e) {
      showToast(typeof e === "string" ? e : "Paket içe aktarılamadı", "error");
    } finally {
      setImporting(false);
    }
  };

  const handleLaunch = async () => {
    try {
      await ltkLaunch();
      showToast("LTK Manager başlatıldı", "success");
    } catch (e) {
      showToast(typeof e === "string" ? e : "LTK başlatılamadı", "error");
    }
  };

  const handleAutostart = async (value: boolean) => {
    setBusyFlag("autostart");
    try {
      const next = await ltkSetAutostart(value);
      setPatcher(next);
      showToast(
        value
          ? "LTK, Windows açılışında otomatik başlatılacak"
          : "Otomatik başlatma kapatıldı",
        "success",
      );
    } catch (e) {
      showToast(typeof e === "string" ? e : "Otomatik başlatma ayarlanamadı", "error");
    } finally {
      setBusyFlag(null);
    }
  };

  const handleFlags = async (value: boolean) => {
    setBusyFlag("flags");
    try {
      const next = await ltkSetPatcherFlags(value);
      setPatcher(next);
      showToast(
        value
          ? "Sessiz mod açık: LTK tepside başlar ve patcher otomatik çalışır"
          : "Sessiz mod kapatıldı",
        "success",
      );
    } catch (e) {
      showToast(typeof e === "string" ? e : "Patcher ayarları güncellenemedi", "error");
    } finally {
      setBusyFlag(null);
    }
  };

  const patcherRunning = Boolean(ltkStatus?.patcherRunning);

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-white/5 bg-void-900/60 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-wide text-slate-100">
              Modlar
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {library
                ? `${library.mods.length} yüklü mod · ${enabledCount} etkin · profil: ${library.activeProfile ?? "—"}`
                : "LTK kütüphanesi yükleniyor"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void refreshLibrary()}
              disabled={loading}
              className="btn-ghost"
            >
              <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
              Yenile
            </button>
            <button
              onClick={() => void handleImport()}
              disabled={importing}
              className="btn-primary"
            >
              <Upload className={clsx("h-4 w-4", importing && "animate-pulse")} />
              Paket İçe Aktar
            </button>
          </div>
        </div>

        <div className="mt-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Mod, yazar veya şampiyon ara..."
            className="w-full rounded-xl border border-white/10 bg-void-800 py-2.5 px-3 text-sm outline-none transition placeholder:text-slate-500 focus:border-neon-violet/50"
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mb-5 rounded-2xl border border-white/10 bg-void-800/40 p-4">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-neon-violet" />
            <h3 className="font-display text-sm font-bold uppercase tracking-widest text-neon-violet/90">
              Patcher Kontrolü
            </h3>
            <span
              className={clsx(
                "ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold",
                patcherRunning
                  ? "bg-neon-lime/15 text-neon-lime"
                  : "bg-rose-500/15 text-rose-400",
              )}
            >
              {patcherRunning ? (
                <ShieldCheck className="h-3.5 w-3.5" />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5" />
              )}
              {patcherRunning ? "Patcher çalışıyor" : "Patcher durdu"}
            </span>
          </div>

          {!ltkStatus?.found ? (
            <p className="mt-3 text-xs leading-relaxed text-rose-300">
              LTK Manager kurulu değil. Mod ve kostüm uygulaması için LTK Manager'ı
              yükleyin.
            </p>
          ) : (
            <>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Oyun içinde modların görünmesi için patcher'ın açık kalması gerekir.
                Aşağıdaki seçeneklerle LTK'yı senin yerine arka planda yönetiyoruz.
              </p>

              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between gap-3 rounded-xl bg-void-900/50 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-200">
                      Windows açılışında başlat
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Bilgisayar açıldığında LTK arka planda başlar, patcher hazır
                      olur.
                    </p>
                  </div>
                  <Toggle
                    checked={Boolean(patcher?.autostartRegistered)}
                    onChange={(v) => void handleAutostart(v)}
                    disabled={busyFlag !== null}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl bg-void-900/50 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-200">
                      Sessiz mod (tepside + otomatik patcher)
                    </p>
                    <p className="text-[11px] text-slate-500">
                      LTK penceresi açılmaz, sistem tepsisinde çalışır ve patcher'ı
                      otomatik başlatır.
                    </p>
                  </div>
                  <Toggle
                    checked={Boolean(
                      patcher?.alwaysStartPatcher && patcher?.startInTray,
                    )}
                    onChange={(v) => void handleFlags(v)}
                    disabled={busyFlag !== null}
                  />
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <button onClick={() => void handleLaunch()} className="btn-ghost">
                  <Play className="h-4 w-4" />
                  LTK'yı Şimdi Başlat
                </button>
                <button onClick={() => void ltkOpen()} className="btn-ghost">
                  <FolderOpen className="h-4 w-4" />
                  LTK'yı Aç
                </button>
              </div>
            </>
          )}
        </div>

        {libraryError && (
          <div className="mb-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-200">
            {libraryError}
          </div>
        )}

        {mods.length === 0 && !loading && !libraryError ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 py-16 text-center">
            <Package className="h-8 w-8 text-slate-600" />
            <p className="text-sm text-slate-400">
              {query
                ? "Aramayla eşleşen mod yok."
                : "Henüz yüklü mod yok. 'Paket İçe Aktar' ile başlayın."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {mods.map((mod) => (
              <ModCard key={mod.id} mod={mod} />
            ))}
          </div>
        )}

        <div className="mt-6 flex items-center gap-1.5 text-[11px] text-slate-600">
          <Power className="h-3 w-3" />
          Modların etkin/pasif durumu LTK profilinde yönetilir.
        </div>
      </div>
    </section>
  );
}
