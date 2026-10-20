import { useCallback, useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
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
  X,
  Clock,
  FileArchive,
  MousePointerClick,
} from "lucide-react";
import clsx from "clsx";
import { useAppStore } from "@/store/appStore";
import {
  ltkImportFile,
  ltkLaunch,
  ltkOpen,
  ltkSetAutostart,
  ltkSetModEnabled,
  ltkSetPatcherFlags,
  openFolder,
  type LtkMod,
} from "@/services/ltkManager";

const MOD_EXTENSIONS = ["fantome", "modpkg", "zip"];

type ModFilter = "all" | "enabled" | "disabled";

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
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
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

function ModCard({
  mod,
  onOpen,
  onToggle,
  busy,
}: {
  mod: LtkMod;
  onOpen: () => void;
  onToggle: (value: boolean) => void;
  busy: boolean;
}) {
  return (
    <article
      onClick={onOpen}
      className="group flex cursor-pointer flex-col gap-3 rounded-2xl border border-white/10 bg-void-800/60 p-4 transition hover:border-neon-violet/40"
    >
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
            <span className="ml-auto">
              <Toggle checked={mod.enabled} onChange={onToggle} disabled={busy} />
            </span>
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
        {Array.from(new Set(mod.champions)).slice(0, 2).map((champ) => (
          <span
            key={champ}
            className="inline-flex items-center gap-1 rounded-md bg-neon-cyan/10 px-2 py-0.5 text-[10px] text-neon-cyan"
          >
            <Tag className="h-3 w-3" />
            {champ}
          </span>
        ))}
        <span className="ml-auto text-[10px] text-slate-600 opacity-0 transition group-hover:opacity-100">
          ayrıntılar
        </span>
      </div>
    </article>
  );
}

function ModDrawer({
  mod,
  onClose,
  onToggle,
  busy,
}: {
  mod: LtkMod;
  onClose: () => void;
  onToggle: (value: boolean) => void;
  busy: boolean;
}) {
  const showToast = useAppStore((s) => s.showToast);

  const handleOpenFolder = async () => {
    if (!mod.path) {
      showToast("Bu mod için klasör yolu bulunamadı", "error");
      return;
    }
    try {
      await openFolder(mod.path);
    } catch (e) {
      showToast(typeof e === "string" ? e : "Klasör açılamadı", "error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-md animate-slideUp flex-col border-l border-white/10 bg-void-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/5 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.25em] text-neon-violet/80">
              Mod Detayı
            </p>
            <h2 className="mt-1 font-display text-xl font-bold tracking-wide text-slate-100">
              {mod.name}
            </h2>
          </div>
          <button onClick={onClose} className="btn-ghost !px-2.5" aria-label="Kapat">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
            <div>
              <p className="text-sm font-semibold">
                {mod.enabled ? "Etkin" : "Pasif"}
              </p>
              <p className="text-xs text-slate-400">
                LTK profilinde modu aç/kapat
              </p>
            </div>
            <Toggle checked={mod.enabled} onChange={onToggle} disabled={busy} />
          </div>

          <div>
            <p className="mb-1 font-display text-xs font-semibold uppercase tracking-wide text-slate-400">
              Açıklama
            </p>
            <p className="text-xs leading-relaxed text-slate-300">
              {mod.description || "Açıklama yok."}
            </p>
          </div>

          {mod.authors.length > 0 && (
            <div>
              <p className="mb-1 font-display text-xs font-semibold uppercase tracking-wide text-slate-400">
                Yazarlar
              </p>
              <p className="text-xs text-slate-300">{mod.authors.join(", ")}</p>
            </div>
          )}

          {mod.champions.length > 0 && (
            <div>
              <p className="mb-1 font-display text-xs font-semibold uppercase tracking-wide text-slate-400">
                Şampiyonlar
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(new Set(mod.champions)).map((champ) => (
                  <span key={champ} className="chip border-neon-cyan/30 text-neon-cyan">
                    {champ}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-4 font-mono text-[11px] text-slate-400">
            <div className="flex justify-between gap-3">
              <span className="text-slate-600">id</span>
              <span className="truncate">{mod.id}</span>
            </div>
            {mod.version && (
              <div className="flex justify-between gap-3">
                <span className="text-slate-600">sürüm</span>
                <span>{mod.version}</span>
              </div>
            )}
            {mod.format && (
              <div className="flex justify-between gap-3">
                <span className="text-slate-600">biçim</span>
                <span>.{mod.format}</span>
              </div>
            )}
            {mod.folder && (
              <div className="flex justify-between gap-3">
                <span className="text-slate-600">klasör</span>
                <span className="truncate">{mod.folder}</span>
              </div>
            )}
            {mod.installedAt && (
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex items-center gap-1 text-slate-600">
                  <Clock className="h-3 w-3" /> kurulum
                </span>
                <span className="text-right">
                  {new Date(mod.installedAt).toLocaleString("tr-TR")}
                </span>
              </div>
            )}
          </div>

          {mod.path && (
            <p className="break-all font-mono text-[10px] leading-relaxed text-slate-600">
              {mod.path}
            </p>
          )}
        </div>

        <footer className="flex gap-2 border-t border-white/5 p-4">
          <button
            onClick={() => void handleOpenFolder()}
            className="btn-ghost flex-1"
            disabled={!mod.path}
          >
            <FolderOpen className="h-4 w-4" />
            Klasörü Aç
          </button>
        </footer>
      </aside>
    </div>
  );
}

export function ModsView() {
  const library = useAppStore((s) => s.library);
  const libraryError = useAppStore((s) => s.libraryError);
  const loading = useAppStore((s) => s.libraryLoading);
  const refreshLibrary = useAppStore((s) => s.refreshLibrary);
  const refreshLtk = useAppStore((s) => s.refreshLtk);
  const setLibrary = useAppStore((s) => s.setLibrary);
  const ltkStatus = useAppStore((s) => s.ltkStatus);
  const patcher = useAppStore((s) => s.patcher);
  const setPatcher = useAppStore((s) => s.setPatcher);
  const showToast = useAppStore((s) => s.showToast);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ModFilter>("all");
  const [importing, setImporting] = useState(false);
  const [busyFlag, setBusyFlag] = useState<"autostart" | "flags" | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const importPaths = useCallback(
    async (paths: string[]) => {
      const accepted = paths.filter((path) => {
        const ext = path.split(".").pop()?.toLowerCase() ?? "";
        return MOD_EXTENSIONS.includes(ext);
      });
      if (accepted.length === 0) {
        showToast(
          "Desteklenen biçimler: .fantome, .modpkg, .zip",
          "error",
        );
        return;
      }
      setImporting(true);
      let failed = 0;
      for (const path of accepted) {
        try {
          await ltkImportFile(path);
        } catch {
          failed += 1;
        }
      }
      setImporting(false);
      if (failed === accepted.length) {
        showToast("Paketler içe aktarılamadı", "error");
        return;
      }
      showToast(
        failed === 0
          ? `${accepted.length} paket LTK'ya gönderildi. Kurulum birkaç saniye sürebilir.`
          : `${accepted.length - failed} paket gönderildi, ${failed} tanesi başarısız oldu.`,
        failed === 0 ? "success" : "info",
      );
      setTimeout(() => {
        void refreshLibrary();
        void refreshLtk();
      }, 4000);
    },
    [refreshLibrary, refreshLtk, showToast],
  );

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void getCurrentWebview()
      .onDragDropEvent((event) => {
        const payload = event.payload;
        if (payload.type === "enter" || payload.type === "over") {
          setDragActive(true);
        } else if (payload.type === "leave") {
          setDragActive(false);
        } else if (payload.type === "drop") {
          setDragActive(false);
          void importPaths(payload.paths);
        }
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [importPaths]);

  const mods = useMemo(() => {
    let list = library?.mods ?? [];
    if (filter === "enabled") list = list.filter((m) => m.enabled);
    if (filter === "disabled") list = list.filter((m) => !m.enabled);
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return list;
    return list.filter(
      (m) =>
        m.name.toLocaleLowerCase("tr-TR").includes(q) ||
        (m.description?.toLocaleLowerCase("tr-TR").includes(q) ?? false) ||
        m.authors.some((a) => a.toLocaleLowerCase("tr-TR").includes(q)) ||
        m.champions.some((c) => c.toLocaleLowerCase("tr-TR").includes(q)),
    );
  }, [library, query, filter]);

  const enabledCount = library?.mods.filter((m) => m.enabled).length ?? 0;
  const selected = library?.mods.find((m) => m.id === selectedId) ?? null;

  const handleImport = async () => {
    try {
      const picked = await open({
        multiple: true,
        title: "Mod paketi seç (.fantome / .modpkg / .zip)",
        filters: [{ name: "Mod paketleri", extensions: MOD_EXTENSIONS }],
      });
      if (!picked) return;
      const paths = Array.isArray(picked) ? picked : [picked];
      if (paths.length === 0) return;
      await importPaths(paths);
    } catch (e) {
      showToast(typeof e === "string" ? e : "Paket içe aktarılamadı", "error");
    }
  };

  const handleToggleMod = async (mod: LtkMod, value: boolean) => {
    setTogglingId(mod.id);
    try {
      const next = await ltkSetModEnabled(mod.id, value);
      setLibrary(next);
      showToast(
        `${mod.name} ${value ? "etkinleştirildi" : "devre dışı bırakıldı"}`,
        "success",
      );
    } catch (e) {
      showToast(
        typeof e === "string" ? e : "Mod durumu güncellenemedi",
        "error",
      );
    } finally {
      setTogglingId(null);
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
      showToast(
        typeof e === "string" ? e : "Otomatik başlatma ayarlanamadı",
        "error",
      );
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
    <section className="relative flex min-w-0 flex-1 flex-col">
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

        <div className="mt-3 flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Mod, yazar veya şampiyon ara..."
            className="flex-1 rounded-xl border border-white/10 bg-void-800 py-2.5 px-3 text-sm outline-none transition placeholder:text-slate-500 focus:border-neon-violet/50"
          />
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-void-800 p-1">
            {(
              [
                ["all", "Tümü"],
                ["enabled", "Etkin"],
                ["disabled", "Pasif"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={clsx(
                  "rounded-lg px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-wide transition",
                  filter === id
                    ? "bg-neon-violet/20 text-neon-violet"
                    : "text-slate-400 hover:text-slate-200",
                )}
              >
                {label}
              </button>
            ))}
          </div>
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
              {query || filter !== "all"
                ? "Eşleşen mod yok."
                : "Henüz yüklü mod yok. 'Paket İçe Aktar' ile başlayın."}
            </p>
            <p className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <MousePointerClick className="h-3.5 w-3.5" />
              Paket dosyalarını pencereye sürükleyerek de ekleyebilirsiniz.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {mods.map((mod) => (
              <ModCard
                key={mod.id}
                mod={mod}
                onOpen={() => setSelectedId(mod.id)}
                onToggle={(value) => void handleToggleMod(mod, value)}
                busy={togglingId === mod.id}
              />
            ))}
          </div>
        )}

        <div className="mt-6 flex items-center gap-1.5 text-[11px] text-slate-600">
          <Power className="h-3 w-3" />
          Modların etkin/pasif durumu LTK profilinde yönetilir. Değişiklikten önce
          library.json yedeklenir.
        </div>
      </div>

      {dragActive && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-void-950/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-neon-cyan/60 bg-neon-cyan/5 px-16 py-12">
            <FileArchive className="h-12 w-12 text-neon-cyan" />
            <p className="font-display text-lg font-bold tracking-wide text-neon-cyan">
              Paketi buraya bırak
            </p>
            <p className="text-xs text-slate-400">
              .fantome · .modpkg · .zip desteklenir
            </p>
          </div>
        </div>
      )}

      {selected && (
        <ModDrawer
          mod={selected}
          onClose={() => setSelectedId(null)}
          onToggle={(value) => void handleToggleMod(selected, value)}
          busy={togglingId === selected.id}
        />
      )}
    </section>
  );
}
