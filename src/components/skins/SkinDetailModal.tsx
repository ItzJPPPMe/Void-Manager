import { useEffect, useMemo, useState } from "react";
import {
  X,
  Heart,
  Download,
  ChevronLeft,
  ChevronRight,
  Layers,
  Check,
  AlertTriangle,
  HardDriveDownload,
  Images,
  ImageDown,
  Copy,
} from "lucide-react";
import clsx from "clsx";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { useChampionStore } from "@/store/championStore";
import { useAppStore } from "@/store/appStore";
import { useSettingsStore } from "@/store/settingsStore";
import { LazyImage } from "@/components/common/LazyImage";
import { RARITY_BADGE, SOURCE_BADGE } from "@/lib/skinMeta";
import { applySkinToLtk, skinPackageUrl } from "@/services/skinActions";
import { importSkinToVoid } from "@/services/skinTransfer";
import { downloadToCache, copyFile, ltkImportFile } from "@/services/ltkManager";

export function SkinDetailModal() {
  const detailSkinId = useAppStore((s) => s.detailSkinId);
  const setDetailSkinId = useAppStore((s) => s.setDetailSkinId);
  const showToast = useAppStore((s) => s.showToast);
  const ltkStatus = useAppStore((s) => s.ltkStatus);
  const refreshLtk = useAppStore((s) => s.refreshLtk);
  const setGalleryChampionId = useAppStore((s) => s.setGalleryChampionId);
  const skins = useChampionStore((s) => s.skins);
  const selectSkin = useChampionStore((s) => s.selectSkin);
  const toggleFavorite = useChampionStore((s) => s.toggleFavorite);
  const markSkinReady = useChampionStore((s) => s.markSkinReady);
  const sendTarget = useSettingsStore((s) => s.settings.sendTarget);
  const [chromaId, setChromaId] = useState<number | null>(null);
  const [applying, setApplying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [savingImage, setSavingImage] = useState(false);

  const skin = useMemo(
    () => skins.find((s) => s.id === detailSkinId) ?? null,
    [skins, detailSkinId],
  );

  const siblings = useMemo(
    () =>
      skin
        ? skins
            .filter((s) => s.championId === skin.championId)
            .sort((a, b) => a.skinNum - b.skinNum)
        : [],
    [skins, skin],
  );

  const index = skin ? siblings.findIndex((s) => s.id === skin.id) : -1;
  const prev = index > 0 ? siblings[index - 1] : null;
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;

  const chroma = skin?.chromas.find((c) => c.id === chromaId) ?? null;
  const previewUrl =
    chroma?.imageUrl || skin?.loadScreenUrl || skin?.splashUrl || null;
  const packageUrl = skin ? skinPackageUrl(skin, chroma) : null;
  const rarity = skin ? RARITY_BADGE[skin.rarity] : undefined;

  const close = () => setDetailSkinId(null);

  useEffect(() => {
    setChromaId(null);
  }, [detailSkinId]);

  useEffect(() => {
    if (!detailSkinId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft" && prev) {
        selectSkin(prev.id);
        setDetailSkinId(prev.id);
      }
      if (e.key === "ArrowRight" && next) {
        selectSkin(next.id);
        setDetailSkinId(next.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailSkinId, prev, next, selectSkin, setDetailSkinId]);

  if (!skin || !detailSkinId) return null;

  const handleApply = async () => {
    if (!packageUrl) {
      showToast(
        "Bu kostüm için mod paketi bulunamadı. Farklı bir kaynak etkinleştirin.",
        "error",
      );
      return;
    }
    setApplying(true);
    try {
      const status = ltkStatus ?? (await refreshLtk());
      if (!status?.found) {
        showToast(
          "LTK Manager bulunamadı. Kostümlerin oyunda görünmesi için LTK Manager gerekir.",
          "error",
        );
        return;
      }
      await applySkinToLtk(skin, chroma);
      markSkinReady(skin.id, chroma ? null : packageUrl);
      showToast(
        "LTK Manager'a gönderildi. Açılan pencerede onaylayıp modu açın ve Start ile yamayı başlatın.",
        "success",
      );
    } catch (err) {
      showToast(
        typeof err === "string"
          ? err
          : err instanceof Error
            ? err.message
            : "LTK Manager'a gönderilemedi",
        "error",
      );
    } finally {
      setApplying(false);
    }
  };

  const handleSendToVoid = async () => {
    if (!packageUrl) return;
    setApplying(true);
    try {
      const mod = await importSkinToVoid(skin, chroma);
      markSkinReady(skin.id, chroma ? null : packageUrl);
      showToast(
        `"${mod.name}" VOID kütüphanesine eklendi ve etkinleştirildi. Modlar sekmesinden yamayı derleyip başlatabilirsin.`,
        "success",
      );
    } catch (err) {
      showToast(
        typeof err === "string"
          ? err
          : err instanceof Error
            ? err.message
            : "VOID Patcher'a eklenemedi",
        "error",
      );
    } finally {
      setApplying(false);
    }
  };

  const handleDownloadImport = async () => {
    if (!packageUrl) return;
    setDownloading(true);
    try {
      const cleanUrl = packageUrl.split("?")[0].split("#")[0];
      const extMatch = cleanUrl.match(/\.(fantome|zip|modpkg)$/i);
      const ext = extMatch ? extMatch[0] : ".fantome";
      const cacheKey = `packages/${skin.id}${
        chromaId ? `-${chromaId}` : ""
      }${ext}`;
      const localPath = await downloadToCache(packageUrl, cacheKey, 0, true);
      await ltkImportFile(localPath);
      showToast(
        "Paket diske indirildi ve LTK Manager'a aktarıldı. Açılan pencerede onaylayın.",
        "success",
      );
      setTimeout(() => void refreshLtk(), 800);
    } catch (err) {
      showToast(
        typeof err === "string"
          ? err
          : err instanceof Error
            ? err.message
            : "Paket indirilemedi",
        "error",
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleSaveImage = async () => {
    if (!previewUrl) return;
    setSavingImage(true);
    try {
      const clean = previewUrl.split("?")[0].split("#")[0];
      const match = clean.match(/\.(png|jpe?g|webp)$/i);
      const ext = match ? match[0].toLowerCase() : ".jpg";
      const cacheKey = `saves/${skin.id}${chromaId ? `-${chromaId}` : ""}${ext}`;
      const cached = await downloadToCache(previewUrl, cacheKey, 0, true);
      const safeName = `${skin.championName}-${chroma ? chroma.name : skin.name}`
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
      const target = await saveDialog({
        defaultPath: `${safeName || `void-skin-${skin.id}`}${ext}`,
        filters: [{ name: "Görsel", extensions: [ext.slice(1)] }],
      });
      if (!target) return;
      await copyFile(cached, target);
      showToast("Görsel kaydedildi", "success");
    } catch (err) {
      showToast(
        typeof err === "string"
          ? err
          : err instanceof Error
            ? err.message
            : "Görsel kaydedilemedi",
        "error",
      );
    } finally {
      setSavingImage(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm sm:p-8"
      onClick={close}
    >
      <div
        className="panel flex h-[88vh] w-full max-w-6xl animate-slideUp flex-col overflow-hidden !rounded-2xl shadow-2xl md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative min-h-[220px] shrink-0 overflow-hidden bg-void-900 md:w-[52%]">
          <LazyImage
            url={previewUrl}
            alt={skin.name}
            eager
            wrapperClassName="h-full w-full"
            className="object-top"
            objectPosition="top"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-void-950 via-void-950/30 to-transparent" />

          <div className="absolute left-4 top-4 flex flex-wrap gap-1.5">
            {rarity && (
              <span className={clsx("chip", rarity.className)}>{rarity.label}</span>
            )}
            {skin.chromas.length > 0 && (
              <span className="chip border-neon-violet/50 bg-neon-violet/15 text-neon-violet">
                <Layers className="h-3 w-3" /> {skin.chromas.length} chroma
              </span>
            )}
            {skin.isLegacy && (
              <span className="chip border-rose-400/50 bg-rose-500/15 text-rose-300">
                LEGACY
              </span>
            )}
            {skin.ready && (
              <span className="chip border-neon-lime/50 bg-neon-lime/15 text-neon-lime">
                <Check className="h-3 w-3" /> HAZIR
              </span>
            )}
          </div>

          <button
            onClick={close}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-black/50 text-slate-300 backdrop-blur-md transition hover:border-rose-400/60 hover:text-rose-300 md:hidden"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="absolute inset-x-4 bottom-4">
            <p className="text-[10px] uppercase tracking-[0.3em] text-neon-cyan/80">
              {skin.championName}
            </p>
            <h2 className="font-display text-3xl font-bold leading-tight tracking-wide text-white drop-shadow-lg">
              {skin.name}
            </h2>
            <p className="mt-1 font-mono text-[11px] text-slate-400">
              #{skin.skinNum} · ID {skin.id}
              {chroma ? ` · chroma ${chroma.id}` : ""}
            </p>
          </div>

          <div className="absolute bottom-4 right-4 flex gap-1">
            <button
              onClick={() => {
                if (!prev) return;
                selectSkin(prev.id);
                setDetailSkinId(prev.id);
              }}
              disabled={!prev}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-black/50 text-slate-200 backdrop-blur-md transition hover:border-neon-cyan/60 disabled:opacity-30"
              aria-label="Önceki kostüm"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                if (!next) return;
                selectSkin(next.id);
                setDetailSkinId(next.id);
              }}
              disabled={!next}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-black/50 text-slate-200 backdrop-blur-md transition hover:border-neon-cyan/60 disabled:opacity-30"
              aria-label="Sonraki kostüm"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-white/5 px-6 py-3">
            <p className="font-display text-xs uppercase tracking-[0.25em] text-slate-400">
              Kostüm Detayı
            </p>
            <button
              onClick={close}
              className="btn-ghost !px-2.5"
              aria-label="Kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-xl font-bold tracking-wide">
                  {chroma ? chroma.name.replace(/^.*Chroma/, "Chroma") : skin.name}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  {skin.description ||
                    (skin.isBase
                      ? "Şampiyonun temel görünümü."
                      : "Bu kostüm için açıklama bulunmuyor.")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => void handleSaveImage()}
                  disabled={!previewUrl || savingImage}
                  className={clsx(
                    "flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-300 transition hover:border-neon-cyan/50 hover:text-neon-cyan",
                    (!previewUrl || savingImage) && "opacity-40",
                  )}
                  title="Görseli kaydet"
                >
                  <ImageDown
                    className={clsx(
                      "h-5 w-5",
                      savingImage && "animate-pulse",
                    )}
                  />
                </button>
                <button
                  onClick={() => toggleFavorite(skin.id)}
                  className={clsx(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition",
                    skin.favorite
                      ? "border-rose-400/60 bg-rose-500/20 text-rose-400"
                      : "border-white/15 bg-white/5 text-slate-300 hover:border-rose-400/50 hover:text-rose-400",
                  )}
                  title={skin.favorite ? "Favoriden çıkar" : "Favorilere ekle"}
                >
                  <Heart
                    className={clsx("h-5 w-5", skin.favorite && "fill-current")}
                  />
                </button>
              </div>
            </div>

            {skin.chromas.length > 0 && (
              <div>
                <p className="mb-2 font-display text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Chromalar
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  <button
                    onClick={() => setChromaId(null)}
                    className={clsx(
                      "group relative overflow-hidden rounded-lg border transition",
                      chromaId === null
                        ? "border-neon-cyan/70 ring-1 ring-neon-cyan/40"
                        : "border-white/10 hover:border-white/30",
                    )}
                  >
                    <LazyImage
                      url={skin.splashUrl}
                      alt="Orijinal"
                      wrapperClassName="aspect-square w-full"
                      objectPosition="top"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-[9px] font-semibold">
                      Orijinal
                    </span>
                  </button>
                  {skin.chromas.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setChromaId(c.id)}
                      className={clsx(
                        "group relative overflow-hidden rounded-lg border transition",
                        chromaId === c.id
                          ? "border-neon-cyan/70 ring-1 ring-neon-cyan/40"
                          : "border-white/10 hover:border-white/30",
                      )}
                      title={c.name}
                    >
                      <LazyImage
                        url={c.imageUrl || skin.splashUrl}
                        alt={c.name}
                        wrapperClassName="aspect-square w-full"
                        objectPosition="top"
                      />
                      <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-[9px] font-semibold">
                        {c.name.replace(/^.*Chroma/, "Chroma")}
                      </span>
                      {c.packageUrl && (
                        <span className="absolute right-1 top-1 rounded bg-neon-lime/80 px-1 text-[8px] font-bold text-black">
                          MOD
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="mb-2 font-display text-xs font-semibold uppercase tracking-wide text-slate-400">
                Kaynaklar
              </p>
              <div className="flex flex-wrap gap-1.5">
                {skin.sources.length === 0 && (
                  <span className="text-xs text-slate-600">Kaynak yok</span>
                )}
                {skin.sources.map((s) => (
                  <span
                    key={s}
                    className={clsx("chip", SOURCE_BADGE[s]?.className)}
                  >
                    {SOURCE_BADGE[s]?.label ?? s}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <div>
                <p className="text-sm font-medium">Mod paketi</p>
                <p className="text-xs text-slate-400">
                  {packageUrl
                    ? "Kostüm için paket mevcut, LTK'ya gönderebilirsiniz."
                    : "Bu kostüm için paket bulunmuyor."}
                </p>
              </div>
              {packageUrl ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(packageUrl)
                        .then(() =>
                          showToast("Paket bağlantısı kopyalandı", "success"),
                        )
                        .catch(() =>
                          showToast("Bağlantı kopyalanamadı", "error"),
                        );
                    }}
                    className="btn-ghost !px-2 !py-1 !text-[11px]"
                    title="Paket bağlantısını kopyala"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  <span className="chip border-neon-lime/50 text-neon-lime">
                    <Check className="h-3 w-3" /> MEVCUT
                  </span>
                </div>
              ) : (
                <span className="chip border-white/15 text-slate-500">
                  <AlertTriangle className="h-3 w-3" /> YOK
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2 border-t border-white/5 px-6 py-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setGalleryChampionId(skin.championId)}
                className="btn-ghost !px-3"
                title="Şampiyonun tüm kostümleri"
              >
                <Images className="h-4 w-4" />
                Galeri
              </button>
              <button
                onClick={() => void handleDownloadImport()}
                disabled={!packageUrl || downloading}
                className={clsx(
                  "btn-secondary flex-1 !py-2.5",
                  (!packageUrl || downloading) && "opacity-50",
                )}
                title="Paketi diske indir ve LTK kütüphanesine aktar"
              >
                <HardDriveDownload className="h-4 w-4" />
                {downloading
                  ? "İndiriliyor..."
                  : !packageUrl
                    ? "Paket Yok"
                    : "İndir ve Aktar"}
              </button>
            </div>
            <button
              onClick={() =>
                void (sendTarget === "void" ? handleSendToVoid() : handleApply())
              }
              disabled={!packageUrl || applying}
              className={clsx(
                "btn-primary w-full !py-2.5",
                (!packageUrl || applying) && "opacity-50",
              )}
              title={
                sendTarget === "void"
                  ? "Paketi VOID kütüphanesine ekle ve etkinleştir"
                  : "Paketi LTK Manager'a gönder"
              }
            >
              <Download className="h-4 w-4" />
              {applying
                ? sendTarget === "void"
                  ? "Ekleniyor..."
                  : "Gönderiliyor..."
                : !packageUrl
                  ? "Paket Yok"
                  : sendTarget === "void"
                    ? "VOID Patcher'a Ekle"
                    : !ltkStatus?.found
                      ? "LTK Manager Yok"
                      : "LTK'ya Gönder"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
