import { useEffect, useState } from "react";
import {
  X,
  Github,
  RefreshCw,
  Trash2,
  Palette,
  Image as ImageIcon,
  Shield,
  FolderOpen,
  Database,
  Info,
  Download,
  Sparkles,
  LayoutGrid,
  Languages,
  Upload,
  FileJson,
} from "lucide-react";
import clsx from "clsx";
import { getVersion } from "@tauri-apps/api/app";
import { save as saveDialog, open as openDialog } from "@tauri-apps/plugin-dialog";
import { useSettingsStore } from "@/store/settingsStore";
import { useAppStore } from "@/store/appStore";
import { useChampionStore } from "@/store/championStore";
import { useCollectionStore } from "@/store/collectionStore";
import { useRepositories } from "@/hooks/useRepositories";
import {
  detectLeaguePath,
  detectRiotClientPath,
  imageCacheStats,
  lcuStatus,
  loadTextFile,
  ltkOpen,
  saveTextFile,
  type CacheStats,
} from "@/services/ltkManager";
import { getImageLoader } from "@/services/imageLoader";
import { checkForUpdate, openReleasePage } from "@/services/updateService";
import type {
  DataSourceMode,
  GridDensity,
  PatchTargetMode,
  SkinNameLanguage,
  ThemeAccent,
} from "@/types/settings";

const ACCENTS: { id: ThemeAccent; label: string; color: string }[] = [
  { id: "cyan", label: "Neon Cyan", color: "#00f0ff" },
  { id: "violet", label: "Neon Violet", color: "#8b5cf6" },
  { id: "magenta", label: "Neon Magenta", color: "#ff2e88" },
  { id: "lime", label: "Neon Lime", color: "#a3ff12" },
];

const DENSITIES: { id: GridDensity; label: string }[] = [
  { id: "compact", label: "Kompakt" },
  { id: "comfortable", label: "Normal" },
  { id: "large", label: "Büyük" },
];

const NAME_LANGUAGES: { id: SkinNameLanguage; label: string }[] = [
  { id: "tr", label: "Türkçe" },
  { id: "en", label: "İngilizce" },
];

const PATCH_MODES: { id: PatchTargetMode; label: string; hint: string }[] = [
  { id: "fantome", label: "Fantome / LTK", hint: ".fantome paketleri için önerilir" },
  { id: "wad-overlay", label: "WAD Overlay", hint: "WAD dosyalarına bindirme" },
  { id: "cslol-compatible", label: "CSLOL Uyumlu", hint: "cslol-manager ile uyumlu" },
];

const DATA_SOURCES: { id: DataSourceMode; label: string; hint: string }[] = [
  {
    id: "auto",
    label: "Otomatik (Önerilen)",
    hint: "İstemci açıksa yerelden (LCU), kapalıysa çevrimiçi kaynaktan çeker.",
  },
  {
    id: "lcu",
    label: "Yerel İstemci (LCU)",
    hint: "Yalnızca çalışan League istemcisinden okur; çevrimdışı çalışır.",
  },
  {
    id: "online",
    label: "Çevrimiçi (CommunityDragon)",
    hint: "Her zaman internetten güncel katalog ve görselleri çeker.",
  },
];

export function SettingsPanel() {
  const settings = useSettingsStore((s) => s.settings);
  const repositories = useSettingsStore((s) => s.repositories);
  const toggleRepository = useSettingsStore((s) => s.toggleRepository);
  const update = useSettingsStore((s) => s.update);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const showToast = useAppStore((s) => s.showToast);
  const ltkStatus = useAppStore((s) => s.ltkStatus);
  const refreshLtk = useAppStore((s) => s.refreshLtk);
  const { sync } = useRepositories();
  const syncRunning = useSettingsStore((s) => s.sync.running);
  const updateInfo = useAppStore((s) => s.updateInfo);
  const setUpdateInfo = useAppStore((s) => s.setUpdateInfo);
  const [tab, setTab] = useState<
    "repos" | "network" | "patch" | "theme" | "about"
  >("repos");
  const [version, setVersion] = useState("—");
  const [checking, setChecking] = useState(false);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [lcu, setLcu] = useState<{ running: boolean; port: number | null }>({
    running: false,
    port: null,
  });

  useEffect(() => {
    void getVersion()
      .then(setVersion)
      .catch(() => setVersion("—"));
    void imageCacheStats()
      .then(setCacheStats)
      .catch(() => setCacheStats(null));
  }, []);

  const refreshCacheStats = () => {
    void imageCacheStats()
      .then(setCacheStats)
      .catch(() => setCacheStats(null));
  };

  const handleLanguageChange = (language: SkinNameLanguage) => {
    if (settings.skinNameLanguage === language) return;
    update({ skinNameLanguage: language });
    if (syncRunning) {
      showToast(
        "Dil değişikliği bir sonraki senkronizasyonda uygulanacak",
        "info",
      );
      return;
    }
    showToast(
      language === "tr"
        ? "Kostüm adları Türkçe olarak yenileniyor..."
        : "Kostüm adları İngilizce olarak yenileniyor...",
      "info",
    );
    void sync();
  };

  const handleExportCollection = async () => {
    const collection = useCollectionStore.getState();
    const payload = {
      app: "void-skin-manager",
      version: 1,
      exportedAt: new Date().toISOString(),
      favorites: collection.favorites,
      recent: collection.recent,
    };
    try {
      const path = await saveDialog({
        defaultPath: "void-favoriler.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!path) return;
      await saveTextFile(path, JSON.stringify(payload, null, 2));
      showToast(
        `${payload.favorites.length} favori ve ${payload.recent.length} son görüntülenen dışa aktarıldı`,
        "success",
      );
    } catch (err) {
      showToast(
        typeof err === "string" ? err : "Yedek dosyası yazılamadı",
        "error",
      );
    }
  };

  const handleImportCollection = async () => {
    setBackupBusy(true);
    try {
      const path = await openDialog({
        multiple: false,
        directory: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (typeof path !== "string") return;
      const text = await loadTextFile(path);
      const parsed = JSON.parse(text) as {
        favorites?: unknown;
        recent?: unknown;
      };
      const asIds = (value: unknown): number[] =>
        Array.isArray(value)
          ? value.filter(
              (item): item is number =>
                typeof item === "number" && Number.isFinite(item),
            )
          : [];
      const favorites = asIds(parsed.favorites);
      const recent = asIds(parsed.recent);
      if (favorites.length === 0 && recent.length === 0) {
        showToast("Dosyada geçerli favori bulunamadı", "error");
        return;
      }
      const counts = useCollectionStore
        .getState()
        .importCollection({ favorites, recent });
      useChampionStore.getState().rehydrateFavorites();
      showToast(`${counts.favorites} favori içe aktarıldı`, "success");
    } catch {
      showToast("Yedek dosyası okunamadı (geçerli JSON değil)", "error");
    } finally {
      setBackupBusy(false);
    }
  };

  const handleCheckUpdate = async () => {
    setChecking(true);
    try {
      const info = await checkForUpdate();
      setUpdateInfo(info);
      showToast(
        info ? `Yeni sürüm mevcut: v${info.latest}` : "Uygulama güncel",
        info ? "success" : "info",
      );
    } catch {
      showToast("Güncelleme kontrol edilemedi", "error");
    } finally {
      setChecking(false);
    }
  };

  const refreshLcu = async () => {
    try {
      const status = await lcuStatus();
      setLcu({ running: status.running, port: status.port });
    } catch {
      setLcu({ running: false, port: null });
    }
  };

  useEffect(() => {
    void refreshLcu();
  }, []);

  const handleDetect = async () => {
    try {
      const [league, riot] = await Promise.all([
        detectLeaguePath(),
        detectRiotClientPath(),
      ]);
      update({
        leaguePath: league.path,
        riotClientPath: riot.path,
      });
      showToast(
        league.found
          ? `League bulundu: ${league.path}`
          : "League of Legends kurulumu bulunamadı",
        league.found ? "success" : "error",
      );
    } catch (err) {
      showToast(
        typeof err === "string" ? err : "Kurulumlar tarama başarısız oldu",
        "error",
      );
    }
  };

  const handleClearCache = async () => {
    try {
      const mb = await getImageLoader().clearCache();
      showToast(`${mb.toFixed(1)} MB önbellek temizlendi`, "success");
      refreshCacheStats();
    } catch (err) {
      showToast(
        typeof err === "string" ? err : "Önbellek temizlenemedi",
        "error",
      );
    }
  };

  const handleOpenLtk = async () => {
    try {
      await ltkOpen();
    } catch (err) {
      showToast(
        typeof err === "string"
          ? err
          : err instanceof Error
            ? err.message
            : "LTK Manager açılamadı",
        "error",
      );
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <div className="panel flex h-[78vh] w-full max-w-4xl flex-col overflow-hidden !rounded-2xl shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-white/5 px-6 py-4">
          <div>
            <h2 className="font-display text-xl font-bold tracking-wide neon-text">
              Ayarlar
            </h2>
            <p className="text-xs text-slate-400">
              Kaynaklar, ağ, patch motoru ve görünüm tercihleri
            </p>
          </div>
          <button
            onClick={() => setSettingsOpen(false)}
            className="btn-ghost !px-2.5"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <nav className="flex shrink-0 gap-1 border-b border-white/5 px-6 py-2">
          {(
            [
              ["repos", "Kaynaklar"],
              ["network", "Görseller & Ağ"],
              ["patch", "Patch Motoru"],
              ["theme", "Tema"],
              ["about", "Hakkında"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={clsx(
                "rounded-lg px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-wide transition",
                tab === id
                  ? "bg-neon-cyan/15 text-neon-cyan shadow-neon"
                  : "text-slate-400 hover:text-slate-200",
              )}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {tab === "repos" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-neon-violet/30 bg-neon-violet/5 px-4 py-3">
                <div>
                  <p className="font-display text-sm font-semibold text-neon-violet">
                    Hibrit Mod
                  </p>
                  <p className="text-xs text-slate-400">
                    Etkin kaynakların tümünden kostümleri birleştirir. Çakışmalarda
                    daha düşük ağırlıklı kaynak yok sayılır.
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={settings.hybridMode}
                  onClick={() => update({ hybridMode: !settings.hybridMode })}
                  className={clsx(
                    "relative h-6 w-11 shrink-0 rounded-full border transition",
                    settings.hybridMode
                      ? "border-neon-violet/60 bg-neon-violet/25"
                      : "border-white/15 bg-white/5",
                  )}
                >
                  <span
                    className="absolute top-0.5 rounded-full transition-all"
                    style={{
                      height: "1.1rem",
                      width: "1.1rem",
                      left: settings.hybridMode ? "calc(100% - 1.25rem)" : "0.125rem",
                      backgroundColor: settings.hybridMode ? "#8b5cf6" : "#64748b",
                    }}
                  />
                </button>
              </div>

              {repositories.map((repo) => (
                <div
                  key={repo.id}
                  className={clsx(
                    "rounded-xl border px-4 py-3 transition",
                    repo.enabled
                      ? "border-neon-cyan/30 bg-neon-cyan/5"
                      : "border-white/10 bg-white/[0.02]",
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Github className="h-4 w-4 shrink-0 text-slate-400" />
                        <h3 className="font-display text-sm font-semibold">
                          {repo.label}
                        </h3>
                        <span className="chip !text-[9px] text-slate-500">
                          ağırlık {repo.weight}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">
                        {repo.description}
                      </p>
                      <p className="mt-1 truncate font-mono text-[10px] text-slate-600">
                        {repo.indexUrl}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleRepository(repo.id)}
                      className={clsx(
                        "shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                        repo.enabled
                          ? "border-neon-lime/40 bg-neon-lime/15 text-neon-lime"
                          : "border-white/15 bg-white/5 text-slate-400 hover:border-white/25",
                      )}
                    >
                      {repo.enabled ? "Etkin" : "Devre dışı"}
                    </button>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-slate-500">
                  Etkin kaynak: {settings.activeRepositories.length} /{" "}
                  {repositories.length}
                </p>
                <button
                  onClick={() => {
                    if (syncRunning) return;
                    void sync();
                    showToast("Senkronizasyon başlatıldı", "info");
                  }}
                  disabled={syncRunning}
                  className={clsx("btn-primary", syncRunning && "opacity-50")}
                >
                  <RefreshCw
                    className={clsx("h-4 w-4", syncRunning && "animate-spin")}
                  />
                  Şimdi Senkronize Et
                </button>
              </div>
            </div>
          )}

          {tab === "network" && (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-neon-lime" />
                <h3 className="font-display text-sm font-semibold uppercase tracking-wide">
                  Veri Kaynağı
                </h3>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span
                    className={clsx(
                      "h-2.5 w-2.5 rounded-full",
                      lcu.running ? "bg-neon-lime" : "bg-slate-600",
                    )}
                  />
                  <div>
                    <p className="text-sm font-medium">
                      League İstemcisi (LCU)
                    </p>
                    <p className="text-xs text-slate-400">
                      {lcu.running
                        ? `Bağlı — yerel port ${lcu.port}`
                        : "Çalışmıyor — çevrimiçi kaynak kullanılacak"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => void refreshLcu()}
                  className="btn-ghost !px-2.5"
                  aria-label="LCU durumunu yenile"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-2">
                {DATA_SOURCES.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => update({ dataSource: d.id })}
                    className={clsx(
                      "flex items-center justify-between rounded-xl border px-4 py-3 text-left transition",
                      settings.dataSource === d.id
                        ? "border-neon-lime/50 bg-neon-lime/10"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20",
                    )}
                  >
                    <div>
                      <p className="font-display text-sm font-semibold">
                        {d.label}
                      </p>
                      <p className="text-xs text-slate-400">{d.hint}</p>
                    </div>
                    {settings.dataSource === d.id && (
                      <span className="chip border-neon-lime/50 text-neon-lime">
                        Seçili
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-neon-cyan" />
                <h3 className="font-display text-sm font-semibold uppercase tracking-wide">
                  Görsel Önbellek
                </h3>
              </div>

              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Disk önbelleği</p>
                  <p className="text-xs text-slate-400">
                    Kapalıyken görseller önbellekten kullanılmaz ve her
                    seferinde yeniden indirilir.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.imageCacheEnabled}
                  onChange={(e) => {
                    update({ imageCacheEnabled: e.target.checked });
                    getImageLoader().configure({ enabled: e.target.checked });
                  }}
                  className="h-4 w-4 accent-cyan-400"
                />
              </label>

              <div>
                <p className="mb-1 text-xs text-slate-400">
                  Önbellek TTL: {settings.imageCacheTtlHours} saat
                </p>
                <input
                  type="range"
                  min={24}
                  max={720}
                  step={24}
                  value={settings.imageCacheTtlHours}
                  onChange={(e) => {
                    const ttlHours = Number(e.target.value);
                    update({ imageCacheTtlHours: ttlHours });
                    getImageLoader().configure({ ttlHours });
                  }}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Önbellek boyutu</p>
                  <p className="text-xs text-slate-400">
                    {cacheStats
                      ? `${cacheStats.files} görsel · ${cacheStats.mb.toFixed(1)} MB`
                      : "Önbellek boyutu okunamadı"}
                  </p>
                </div>
                <button
                  onClick={() => void handleClearCache()}
                  className="btn-ghost shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                  Temizle
                </button>
              </div>

              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Açılışta otomatik senkron</p>
                  <p className="text-xs text-slate-400">
                    Uygulama başlarken etkin kaynakların indeksini çeker.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoSyncOnLaunch}
                  onChange={(e) =>
                    update({ autoSyncOnLaunch: e.target.checked })
                  }
                  className="h-4 w-4 accent-cyan-400"
                />
              </label>
            </div>
          )}

          {tab === "patch" && (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-neon-violet" />
                <h3 className="font-display text-sm font-semibold uppercase tracking-wide">
                  LTK / CSLOL Patch Motoru
                </h3>
              </div>

              <div
                className={clsx(
                  "rounded-xl border p-4",
                  ltkStatus?.found
                    ? "border-neon-lime/40 bg-neon-lime/5"
                    : "border-rose-500/40 bg-rose-500/5",
                )}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={clsx(
                        "h-2.5 w-2.5 rounded-full",
                        ltkStatus?.found ? "bg-neon-lime" : "bg-rose-500",
                      )}
                    />
                    <div>
                      <p className="font-display text-sm font-semibold">
                        {ltkStatus?.found
                          ? "LTK Manager bulundu"
                          : "LTK Manager bulunamadı"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {!ltkStatus?.found
                          ? "Kostümleri oyunda görmek için LTK Manager kurmalısınız."
                          : ltkStatus.patcherRunning
                            ? "Patcher çalışıyor. Oyunu Riot Client'ten normal başlatabilirsiniz."
                            : "Patcher çalışmıyor. LTK Manager'dan başlatın; oyunu normal açmanız yeterli."}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => void refreshLtk()}
                      className="btn-ghost !px-2.5"
                      aria-label="LTK durumunu yenile"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => void handleOpenLtk()}
                      disabled={!ltkStatus?.found}
                      className={clsx("btn-primary", !ltkStatus?.found && "opacity-50")}
                    >
                      <FolderOpen className="h-4 w-4" />
                      LTK Manager'ı Aç
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 font-mono text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-slate-500">motor</span>
                    <span className="truncate text-slate-400">
                      {ltkStatus?.exePath ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-slate-500">oyun </span>
                    <span className="truncate text-slate-400">
                      {ltkStatus?.gamePath ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-slate-500">host </span>
                    <span
                      className={clsx(
                        "truncate",
                        ltkStatus?.patcherRunning
                          ? "text-neon-lime"
                          : "text-rose-400",
                      )}
                    >
                      ltk_patcher_host.exe ·{" "}
                      {ltkStatus?.patcherRunning ? "çalışıyor" : "durdu"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <p className="mb-3 text-xs text-slate-400">
                  Otomatik Algılama — Riot Client ve League of Legends kurulum
                  dizinleri Windows Kayıt Defteri ve bilinen yollar taranarak bulunur.
                </p>
                <button onClick={() => void handleDetect()} className="btn-primary">
                  <FolderOpen className="h-4 w-4" />
                  Kurulum Dizinlerini Algıla
                </button>
                <div className="mt-3 grid gap-2 font-mono text-[11px]">
                  <div className="flex items-center gap-2">
                    <span
                      className={clsx(
                        "h-2 w-2 rounded-full",
                        settings.leaguePath ? "bg-neon-lime" : "bg-rose-500",
                      )}
                    />
                    <span className="truncate text-slate-400">
                      {settings.leaguePath ?? "League yolu bulunamadı"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={clsx(
                        "h-2 w-2 rounded-full",
                        settings.riotClientPath ? "bg-neon-lime" : "bg-rose-500",
                      )}
                    />
                    <span className="truncate text-slate-400">
                      {settings.riotClientPath ?? "Riot Client yolu bulunamadı"}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs text-slate-400">Patch hedef modu</p>
                <div className="grid gap-2">
                  {PATCH_MODES.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => update({ patchTargetMode: m.id })}
                      className={clsx(
                        "flex items-center justify-between rounded-xl border px-4 py-3 text-left transition",
                        settings.patchTargetMode === m.id
                          ? "border-neon-violet/50 bg-neon-violet/10"
                          : "border-white/10 bg-white/[0.02] hover:border-white/20",
                      )}
                    >
                      <div>
                        <p className="font-display text-sm font-semibold">
                          {m.label}
                        </p>
                        <p className="text-xs text-slate-400">{m.hint}</p>
                      </div>
                      {settings.patchTargetMode === m.id && (
                        <span className="chip border-neon-violet/50 text-neon-violet">
                          Seçili
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "theme" && (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-neon-magenta" />
                <h3 className="font-display text-sm font-semibold uppercase tracking-wide">
                  Vurgu Rengi
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {ACCENTS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => update({ themeAccent: a.id })}
                    className={clsx(
                      "flex flex-col items-center gap-2 rounded-xl border px-4 py-5 transition",
                      settings.themeAccent === a.id
                        ? "border-white/30 bg-white/5 shadow-card"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20",
                    )}
                  >
                    <span
                      className="h-10 w-10 rounded-full"
                      style={{
                        backgroundColor: a.color,
                        boxShadow: `0 0 16px ${a.color}80`,
                      }}
                    />
                    <span className="text-xs font-semibold">{a.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs leading-relaxed text-slate-500">
                Vurgu rengi tüm arayüzde anında uygulanır ve tercih olarak
                saklanır. Neon Cyan varsayılandır.
              </p>

              <div className="flex items-center gap-2 pt-2">
                <LayoutGrid className="h-4 w-4 text-neon-cyan" />
                <h3 className="font-display text-sm font-semibold uppercase tracking-wide">
                  Kart Yoğunluğu
                </h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {DENSITIES.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => update({ gridDensity: d.id })}
                    className={clsx(
                      "rounded-xl border px-3 py-2.5 text-xs font-semibold transition",
                      settings.gridDensity === d.id
                        ? "border-neon-cyan/60 bg-neon-cyan/10 text-neon-cyan"
                        : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20",
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <p className="text-xs leading-relaxed text-slate-500">
                Kostüm ızgarasının kart boyutunu belirler.
              </p>

              <div className="flex items-center gap-2 pt-2">
                <Languages className="h-4 w-4 text-neon-violet" />
                <h3 className="font-display text-sm font-semibold uppercase tracking-wide">
                  Kostüm Adları
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {NAME_LANGUAGES.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => handleLanguageChange(l.id)}
                    className={clsx(
                      "rounded-xl border px-3 py-2.5 text-xs font-semibold transition",
                      settings.skinNameLanguage === l.id
                        ? "border-neon-violet/60 bg-neon-violet/10 text-neon-violet"
                        : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20",
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <p className="text-xs leading-relaxed text-slate-500">
                Değişiklik kostüm adlarının yeniden senkronize edilmesini
                gerektirir ve otomatik başlatılır. Mod adları her zaman Türkçe
                kalır.
              </p>
            </div>
          )}

          {tab === "about" && (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-neon-cyan" />
                <h3 className="font-display text-sm font-semibold uppercase tracking-wide">
                  VOID Skin Manager
                </h3>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Sürüm</p>
                  <p className="font-mono text-xs text-slate-400">v{version}</p>
                </div>
                <button
                  onClick={() => void handleCheckUpdate()}
                  disabled={checking}
                  className={clsx("btn-primary", checking && "opacity-50")}
                >
                  <RefreshCw
                    className={clsx("h-4 w-4", checking && "animate-spin")}
                  />
                  Güncellemeyi Denetle
                </button>
              </div>

              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <div>
                  <p className="text-sm font-medium">
                    Açılışta güncelleme denetimi
                  </p>
                  <p className="text-xs text-slate-400">
                    Uygulama açılırken yeni sürüm olup olmadığını kontrol eder.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.checkUpdateOnLaunch}
                  onChange={(e) =>
                    update({ checkUpdateOnLaunch: e.target.checked })
                  }
                  className="h-4 w-4 accent-cyan-400"
                />
              </label>

              {updateInfo && (
                <div className="rounded-xl border border-neon-lime/40 bg-neon-lime/5 p-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-neon-lime" />
                    <p className="font-display text-sm font-semibold text-neon-lime">
                      v{updateInfo.latest} hazır
                    </p>
                  </div>
                  {updateInfo.notes && (
                    <p className="mt-2 max-h-32 overflow-y-auto whitespace-pre-line text-xs leading-relaxed text-slate-300">
                      {updateInfo.notes}
                    </p>
                  )}
                  <button
                    onClick={() =>
                      void openReleasePage(updateInfo.url).catch(() =>
                        showToast("Sürüm sayfası açılamadı", "error"),
                      )
                    }
                    className="btn-primary mt-3"
                  >
                    <Download className="h-4 w-4" />
                    Sürüm Sayfasını Aç
                  </button>
                </div>
              )}

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-center gap-2">
                  <FileJson className="h-4 w-4 text-neon-lime" />
                  <p className="text-sm font-medium">Koleksiyon Yedeği</p>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  Favorileri ve son görüntülenenleri JSON dosyasına aktarın;
                  başka bir bilgisayarda içe aktararak koleksiyonunuzu taşıyın.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => void handleExportCollection()}
                    disabled={backupBusy}
                    className="btn-ghost"
                  >
                    <Download className="h-4 w-4" />
                    Dışa Aktar
                  </button>
                  <button
                    onClick={() => void handleImportCollection()}
                    disabled={backupBusy}
                    className={clsx("btn-ghost", backupBusy && "opacity-50")}
                  >
                    <Upload className="h-4 w-4" />
                    İçe Aktar
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-sm font-medium">Açık kaynak</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  VOID, MIT lisanslı bir topluluk projesidir. Riot Games ile
                  bağlantılı değildir. Kostüm modları LTK Manager üzerinden
                  uygulanır.
                </p>
                <button
                  onClick={() =>
                    void openReleasePage(
                      "https://github.com/ItzJPPPMe/Void-Manager",
                    ).catch(() =>
                      showToast("Bağlantı açılamadı", "error"),
                    )
                  }
                  className="btn-ghost mt-3"
                >
                  <Github className="h-4 w-4" />
                  GitHub Deposu
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
