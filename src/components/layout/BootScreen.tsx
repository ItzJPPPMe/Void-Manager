import { useEffect, useState } from "react";
import { Zap, Loader2 } from "lucide-react";

interface BootScreenProps {
  done: boolean;
}

const STEPS = [
  "Sürücüler uyandırılıyor",
  "Katalog bağlantısı kuruluyor",
  "Görsel önbelleği hazırlanıyor",
  "Arayüz derleniyor",
];

export function BootScreen({ done }: BootScreenProps) {
  const [visible, setVisible] = useState(!done);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (done) {
      const timer = setTimeout(() => setVisible(false), 420);
      return () => clearTimeout(timer);
    }
    const timer = setInterval(() => {
      setStep((s) => (s >= STEPS.length - 1 ? s : s + 1));
    }, 260);
    return () => clearInterval(timer);
  }, [done]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-void-950 transition-opacity duration-500 ${
        done ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,240,255,0.12),transparent_60%)]" />

      <div className="relative flex flex-col items-center gap-8">
        <div className="relative">
          <div className="absolute inset-0 rounded-3xl bg-neon-cyan/20 blur-2xl" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl border border-neon-cyan/40 bg-void-900/80">
            <Zap className="h-10 w-10 text-neon-cyan drop-shadow-[0_0_12px_rgba(0,240,255,0.8)]" />
          </div>
        </div>

        <div className="text-center">
          <h1 className="font-display text-4xl font-bold tracking-[0.3em] text-white">
            V<span className="text-neon-cyan">O</span>ID
          </h1>
          <p className="mt-2 text-[11px] uppercase tracking-[0.4em] text-slate-500">
            Skin Manager
          </p>
        </div>

        <div className="w-64">
          <div className="h-1 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-violet transition-all duration-500"
              style={{ width: `${done ? 100 : 18 + step * 20}%` }}
            />
          </div>
          <p className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-400">
            {!done && <Loader2 className="h-3 w-3 animate-spin" />}
            {done ? "Hazır" : STEPS[step]}
          </p>
        </div>
      </div>
    </div>
  );
}
