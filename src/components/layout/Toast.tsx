import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import clsx from "clsx";
import { useAppStore } from "@/store/appStore";

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
} as const;

const COLORS = {
  success: "border-neon-lime/40 bg-neon-lime/10 text-neon-lime",
  error: "border-rose-500/40 bg-rose-500/10 text-rose-400",
  info: "border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan",
} as const;

export function Toast() {
  const toast = useAppStore((s) => s.toast);
  const clearToast = useAppStore((s) => s.clearToast);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          className="pointer-events-none fixed bottom-16 left-1/2 z-50 -translate-x-1/2"
        >
          <button
            onClick={clearToast}
            className={clsx(
              "pointer-events-auto flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium backdrop-blur-md",
              COLORS[toast.type],
            )}
          >
            {(() => {
              const Icon = ICONS[toast.type];
              return <Icon className="h-4 w-4" />;
            })()}
            {toast.message}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
