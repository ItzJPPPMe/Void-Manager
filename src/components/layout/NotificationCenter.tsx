import {
  Bell,
  CheckCheck,
  Info,
  Trash2,
  TriangleAlert,
  X,
  CircleCheck,
  CircleX,
} from "lucide-react";
import clsx from "clsx";
import {
  useNotificationStore,
  type NotificationKind,
} from "@/store/notificationStore";

const KIND_STYLE: Record<
  NotificationKind,
  { icon: typeof Info; className: string; label: string }
> = {
  success: { icon: CircleCheck, className: "text-neon-lime", label: "Başarılı" },
  error: { icon: CircleX, className: "text-rose-400", label: "Hata" },
  info: { icon: Info, className: "text-neon-cyan", label: "Bilgi" },
  warning: { icon: TriangleAlert, className: "text-neon-amber", label: "Uyarı" },
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "az önce";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} dk önce`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} sa önce`;
  return new Date(ts).toLocaleDateString("tr-TR");
}

export function NotificationCenter() {
  const items = useNotificationStore((s) => s.items);
  const open = useNotificationStore((s) => s.panelOpen);
  const setOpen = useNotificationStore((s) => s.setPanelOpen);
  const dismiss = useNotificationStore((s) => s.dismiss);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const clearAll = useNotificationStore((s) => s.clearAll);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <aside
        className="animate-reveal-up flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-void-900/95 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
          <Bell className="h-4 w-4 text-neon-cyan" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-neon-cyan/80">
              Bildirim Merkezi
            </p>
            <h2 className="font-display text-lg font-bold tracking-wide text-slate-100">
              {items.length} kayıt
            </h2>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={markAllRead}
              className="btn-ghost !px-2 !py-1.5"
              title="Tümünü okundu işaretle"
            >
              <CheckCheck className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={clearAll}
              className="btn-ghost !px-2 !py-1.5 hover:!border-rose-400/40 hover:!text-rose-300"
              title="Tümünü sil"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="btn-ghost !px-2 !py-1.5"
              aria-label="Kapat"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <Bell className="h-8 w-8 text-slate-700" />
              <p className="text-sm text-slate-500">Henüz bildirim yok</p>
              <p className="max-w-[220px] text-xs text-slate-600">
                Senkronizasyon, indirme ve mod işlemleri burada listelenir.
              </p>
            </div>
          ) : (
            items.map((item) => {
              const style = KIND_STYLE[item.kind];
              const Icon = style.icon;
              return (
                <article
                  key={item.id}
                  className={clsx(
                    "surface surface-hover animate-pop-in group relative px-4 py-3",
                    !item.read && "border-neon-cyan/30 bg-neon-cyan/[0.05]",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Icon className={clsx("mt-0.5 h-4 w-4 shrink-0", style.className)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13px] font-semibold text-slate-100">
                          {item.title}
                        </p>
                        <span className="ml-auto shrink-0 text-[10px] text-slate-600">
                          {timeAgo(item.createdAt)}
                        </span>
                      </div>
                      {item.message && (
                        <p className="mt-0.5 break-words text-xs leading-relaxed text-slate-400">
                          {item.message}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => dismiss(item.id)}
                      className="absolute right-1.5 top-1.5 rounded p-1 text-slate-600 opacity-0 transition hover:text-rose-300 group-hover:opacity-100"
                      aria-label="Sil"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
