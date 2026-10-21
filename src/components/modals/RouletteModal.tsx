import { useEffect, useMemo, useRef, useState } from "react";
import { Dices, RotateCw, Sparkles, X, Check, Maximize2 } from "lucide-react";
import clsx from "clsx";
import { useAppStore } from "@/store/appStore";
import { useChampionStore } from "@/store/championStore";
import { RARITY_BADGE } from "@/lib/skinMeta";
import type { Skin } from "@/types/champion";

const SLOTS = 10;
const SPIN_MS = 3600;

function pickWeighted(skins: Skin[]): Skin {
  const total = skins.reduce((sum, s) => {
    const rarity = s.rarity === "kUltimate" ? 8 : s.rarity === "kMythic" ? 6 : 1;
    return sum + rarity;
  }, 0);
  let roll = Math.random() * total;
  for (const skin of skins) {
    const rarity = skin.rarity === "kUltimate" ? 8 : skin.rarity === "kMythic" ? 6 : 1;
    roll -= rarity;
    if (roll <= 0) return skin;
  }
  return skins[skins.length - 1];
}

export function RouletteModal() {
  const open = useAppStore((s) => s.rouletteOpen);
  const setOpen = useAppStore((s) => s.setRouletteOpen);
  const skins = useChampionStore((s) => s.skins);
  const selectSkin = useChampionStore((s) => s.selectSkin);
  const selectChampion = useChampionStore((s) => s.selectChampion);
  const setDetailSkinId = useAppStore((s) => s.setDetailSkinId);
  const setCinematicSkinId = useAppStore((s) => s.setCinematicSkinId);

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Skin | null>(null);
  const [pool, setPool] = useState<"all" | "favorites" | "rare">("all");
  const frame = useRef<number | null>(null);

  const candidates = useMemo(() => {
    if (pool === "favorites") return skins.filter((s) => s.favorite);
    if (pool === "rare") {
      return skins.filter(
        (s) =>
          s.rarity === "kUltimate" ||
          s.rarity === "kMythic" ||
          s.rarity === "kLegendary" ||
          s.rarity === "kExalted",
      );
    }
    return skins;
  }, [skins, pool]);

  const wheelItems = useMemo(() => {
    if (candidates.length === 0) return [];
    const step = Math.max(1, Math.floor(candidates.length / SLOTS));
    const out: Skin[] = [];
    for (let i = 0; i < SLOTS; i += 1) {
      out.push(candidates[Math.min(i * step, candidates.length - 1)]);
    }
    return out;
  }, [candidates]);

  useEffect(() => {
    if (!open) {
      setWinner(null);
      setSpinning(false);
    }
  }, [open]);

  useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    },
    [],
  );

  if (!open) return null;

  const spin = () => {
    if (spinning || candidates.length === 0) return;
    setSpinning(true);
    setWinner(null);

    const chosen = pickWeighted(candidates);
    const index = Math.max(
      0,
      wheelItems.findIndex((s) => s.id === chosen.id),
    );
    const segmentAngle = 360 / SLOTS;
    const target = 360 * 6 + (360 - index * segmentAngle - segmentAngle / 2);
    const from = rotation;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / SPIN_MS);
      const eased = 1 - Math.pow(1 - t, 4);
      setRotation(from + (target - from) * eased);
      if (t < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        setSpinning(false);
        setWinner(chosen);
      }
    };
    frame.current = requestAnimationFrame(tick);
  };

  const applyWinner = () => {
    if (!winner) return;
    selectChampion(winner.championId);
    selectSkin(winner.id);
    setDetailSkinId(winner.id);
    setOpen(false);
  };

  const preview = () => {
    if (!winner) return;
    setCinematicSkinId(winner.id);
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-md"
      onClick={() => setOpen(false)}
    >
      <div
        className="animate-pop-in glass flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-white/5 px-6 py-4">
          <Dices className="h-5 w-5 text-neon-magenta" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-neon-magenta/80">
              Skin Roulette
            </p>
            <h2 className="font-display text-xl font-bold tracking-wide text-slate-100">
              Şansını Dene
            </h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="btn-ghost ml-auto !px-2.5"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start">
            <div className="relative mx-auto h-72 w-72 shrink-0">
              <div className="absolute inset-0 rounded-full bg-neon-magenta/10 blur-2xl" />
              <div
                className="relative h-full w-full rounded-full border border-white/10"
                style={{ transform: `rotate(${rotation}deg)` }}
              >
                <svg viewBox="0 0 200 200" className="h-full w-full">
                  {wheelItems.map((skin, i) => {
                    const start = (i * 360) / SLOTS - 90;
                    const end = ((i + 1) * 360) / SLOTS - 90;
                    const colors = [
                      "rgba(0,240,255,0.16)",
                      "rgba(139,92,246,0.16)",
                      "rgba(255,46,136,0.14)",
                      "rgba(163,255,18,0.12)",
                    ];
                    const a0 = (start * Math.PI) / 180;
                    const a1 = (end * Math.PI) / 180;
                    const x0 = 100 + 92 * Math.cos(a0);
                    const y0 = 100 + 92 * Math.sin(a0);
                    const x1 = 100 + 92 * Math.cos(a1);
                    const y1 = 100 + 92 * Math.sin(a1);
                    const mid = ((start + end) / 2) * (Math.PI / 180);
                    const lx = 100 + 58 * Math.cos(mid);
                    const ly = 100 + 58 * Math.sin(mid);
                    return (
                      <g key={`${skin.id}-${i}`}>
                        <path
                          d={`M 100 100 L ${x0} ${y0} A 92 92 0 0 1 ${x1} ${y1} Z`}
                          fill={colors[i % colors.length]}
                          stroke="rgba(255,255,255,0.08)"
                        />
                        <text
                          x={lx}
                          y={ly}
                          fill="rgba(226,232,240,0.85)"
                          fontSize="6.5"
                          textAnchor="middle"
                          transform={`rotate(${((start + end) / 2) + 90} ${lx} ${ly})`}
                        >
                          {skin.championName.slice(0, 14)}
                        </text>
                      </g>
                    );
                  })}
                  <circle cx="100" cy="100" r="22" fill="#0a0c14" stroke="rgba(255,255,255,0.12)" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-display text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    VOID
                  </span>
                </div>
              </div>

              <div className="absolute -top-1 left-1/2 z-10 -translate-x-1/2">
                <div className="h-0 w-0 border-x-[11px] border-t-[18px] border-x-transparent border-t-neon-cyan drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div className="flex gap-1 rounded-xl border border-white/10 bg-void-800 p-1">
                {(
                  [
                    ["all", "Tümü"],
                    ["favorites", "Favoriler"],
                    ["rare", "Nadir"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setPool(id)}
                    disabled={spinning}
                    className={clsx(
                      "flex-1 rounded-lg px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-wide transition disabled:opacity-40",
                      pool === id
                        ? "bg-neon-magenta/20 text-neon-magenta"
                        : "text-slate-400 hover:text-slate-200",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <p className="text-xs text-slate-500">
                Havuz: <span className="text-slate-300">{candidates.length}</span> kostüm ·
                Nadir kostümler daha yüksek şansla çıkar.
              </p>

              <button
                onClick={spin}
                disabled={spinning || candidates.length === 0}
                className="btn-primary w-full !py-3"
              >
                <RotateCw
                  className={clsx("h-4 w-4", spinning && "animate-spin")}
                />
                {spinning ? "Dönüyor..." : "Çevir"}
              </button>

              {winner && !spinning && (
                <div className="animate-pop-in space-y-3 rounded-xl border border-neon-lime/30 bg-neon-lime/5 p-4">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-neon-lime">
                    <Check className="h-3.5 w-3.5" /> Kazanan
                  </div>
                  <p className="font-display text-lg font-bold text-slate-100">
                    {winner.name}
                  </p>
                  <p className="text-xs text-slate-400">{winner.championName}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="chip border-white/15 text-slate-300">
                      {RARITY_BADGE[winner.rarity]?.label ?? winner.rarity}
                    </span>
                    {winner.chromas.length > 0 && (
                      <span className="chip border-neon-cyan/30 text-neon-cyan">
                        {winner.chromas.length} chroma
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={applyWinner} className="btn-primary flex-1">
                      <Sparkles className="h-3.5 w-3.5" /> Aç
                    </button>
                    <button onClick={preview} className="btn-ghost">
                      <Maximize2 className="h-3.5 w-3.5" /> Önizle
                    </button>
                  </div>
                </div>
              )}

              {!winner && !spinning && (
                <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-xs text-slate-600">
                  Çevir'e bas ve kırmızı okun işaret ettiği kostüm senin olsun.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
