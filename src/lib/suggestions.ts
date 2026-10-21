import type { Skin } from "@/types/champion";
import { rarityRank } from "@/lib/skinMeta";

export type SuggestionReason = "champion" | "favorite" | "rare" | "chroma" | "recent";

export interface Suggestion {
  skin: Skin;
  reason: SuggestionReason;
  label: string;
  weight: number;
}

const REASON_LABEL: Record<SuggestionReason, string> = {
  champion: "Aynı şampiyon",
  favorite: "Favori şampiyonun",
  rare: "Nadir kostüm",
  chroma: "Chroma'ları var",
  recent: "Yakın bakılanlar",
};

export function buildSuggestions(
  skins: Skin[],
  favorites: number[],
  recent: number[],
  limit = 12,
): Suggestion[] {
  if (skins.length === 0) return [];

  const byId = new Map(skins.map((s) => [s.id, s]));
  const favoriteSkins = favorites
    .map((id) => byId.get(id))
    .filter((s): s is Skin => Boolean(s));
  const recentSkins = recent
    .map((id) => byId.get(id))
    .filter((s): s is Skin => Boolean(s));

  const favoriteChampions = new Set(favoriteSkins.map((s) => s.championId));
  const recentChampions = new Set(recentSkins.map((s) => s.championId));
  const seen = new Set<number>();
  const out: Suggestion[] = [];

  const push = (skin: Skin, reason: SuggestionReason, weight: number) => {
    if (seen.has(skin.id) || out.length >= limit) return;
    seen.add(skin.id);
    out.push({ skin, reason, label: REASON_LABEL[reason], weight });
  };

  for (const skin of recentSkins) {
    for (const candidate of skins) {
      if (candidate.championId === skin.championId && candidate.id !== skin.id) {
        push(candidate, "recent", 100);
      }
    }
  }

  for (const skin of favoriteSkins) {
    for (const candidate of skins) {
      if (
        candidate.championId === skin.championId &&
        favoriteChampions.has(candidate.championId)
      ) {
        push(candidate, "champion", 90);
      }
    }
  }

  for (const skin of favoriteSkins) {
    for (const candidate of skins) {
      if (
        favoriteChampions.has(candidate.championId) &&
        !recentChampions.has(candidate.championId) &&
        candidate.championId !== skin.championId
      ) {
        push(candidate, "favorite", 70);
      }
    }
  }

  const rarePool = skins
    .filter((s) => rarityRank(s.rarity) >= 7)
    .sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity));
  for (const skin of rarePool) {
    push(skin, "rare", 60);
  }

  const chromaPool = skins.filter((s) => s.chromas.length > 3);
  for (const skin of chromaPool) {
    push(skin, "chroma", 40);
  }

  return out.sort((a, b) => b.weight - a.weight).slice(0, limit);
}

export interface CollectionInsights {
  total: number;
  favorites: number;
  ready: number;
  withChroma: number;
  champions: number;
  rarity: { rarity: string; count: number }[];
  championLeaderboard: { championId: number; championName: string; count: number }[];
  topFavoriteChampions: { championId: number; championName: string; count: number }[];
  coverage: number;
}

export function buildInsights(
  skins: Skin[],
  favorites: number[],
): CollectionInsights {
  const favoriteSet = new Set(favorites);
  const byChampion = new Map<number, number>();
  const byRarity = new Map<string, number>();
  const favoriteByChampion = new Map<number, number>();
  const championNames = new Map<number, string>();

  let ready = 0;
  let withChroma = 0;

  for (const skin of skins) {
    byChampion.set(skin.championId, (byChampion.get(skin.championId) ?? 0) + 1);
    championNames.set(skin.championId, skin.championName);
    byRarity.set(skin.rarity, (byRarity.get(skin.rarity) ?? 0) + 1);
    if (skin.ready) ready += 1;
    if (skin.chromas.length > 0) withChroma += 1;
    if (favoriteSet.has(skin.id)) {
      favoriteByChampion.set(
        skin.championId,
        (favoriteByChampion.get(skin.championId) ?? 0) + 1,
      );
    }
  }

  const championLeaderboard = [...byChampion.entries()]
    .map(([championId, count]) => ({
      championId,
      championName: championNames.get(championId) ?? "",
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const topFavoriteChampions = [...favoriteByChampion.entries()]
    .map(([championId, count]) => ({
      championId,
      championName: championNames.get(championId) ?? "",
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const rarity = [...byRarity.entries()]
    .map(([rarity, count]) => ({ rarity, count }))
    .sort((a, b) => b.count - a.count);

  return {
    total: skins.length,
    favorites: favorites.length,
    ready,
    withChroma,
    champions: byChampion.size,
    rarity,
    championLeaderboard,
    topFavoriteChampions,
    coverage: skins.length === 0 ? 0 : Math.round((ready / skins.length) * 100),
  };
}
