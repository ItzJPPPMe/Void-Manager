import type { SkinSourceType } from "@/types/champion";

export const SOURCE_BADGE: Record<
  SkinSourceType,
  { label: string; className: string }
> = {
  bettie9: { label: "Sunshine", className: "border-amber-400/40 text-amber-300" },
  alban1911: {
    label: "Rose",
    className: "border-fuchsia-400/40 text-fuchsia-300",
  },
  darkseal: { label: "Community", className: "border-sky-400/40 text-sky-300" },
  local: { label: "Yerel", className: "border-neon-lime/40 text-neon-lime" },
};

export const RARITY_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  kUltimate: {
    label: "ULTIMATE",
    className: "border-red-400/50 bg-red-500/15 text-red-300",
  },
  kMythic: {
    label: "MYTHIC",
    className: "border-amber-400/50 bg-amber-500/15 text-amber-300",
  },
  kLegendary: {
    label: "LEGENDARY",
    className: "border-orange-400/50 bg-orange-500/15 text-orange-300",
  },
  kEpic: {
    label: "EPİK",
    className: "border-purple-400/50 bg-purple-500/15 text-purple-300",
  },
  kExalted: {
    label: "EXALTED",
    className: "border-pink-400/50 bg-pink-500/15 text-pink-300",
  },
  kTranscendent: {
    label: "TRANSCENDENT",
    className: "border-cyan-400/50 bg-cyan-500/15 text-cyan-300",
  },
  kRare: {
    label: "NADİR",
    className: "border-sky-400/50 bg-sky-500/15 text-sky-300",
  },
  kNoRarity: {
    label: "SIRADAN",
    className: "border-white/20 bg-white/5 text-slate-400",
  },
};

export const RARITY_RANK: Record<string, number> = {
  kUltimate: 10,
  kTranscendent: 9,
  kExalted: 8,
  kMythic: 7,
  kLegendary: 6,
  kEpic: 5,
  kRare: 2,
  kNoRarity: 0,
};

export function rarityRank(rarity: string): number {
  return RARITY_RANK[rarity] ?? 0;
}
