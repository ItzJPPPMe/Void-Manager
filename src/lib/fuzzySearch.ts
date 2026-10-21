export interface FuzzyMatch {
  score: number;
  indices: number[];
}

const TURKISH_MAP: Record<string, string> = {
  ç: "c",
  Ç: "c",
  ğ: "g",
  Ğ: "g",
  ı: "i",
  İ: "i",
  ö: "o",
  Ö: "o",
  ş: "s",
  Ş: "s",
  ü: "u",
  Ü: "u",
  â: "a",
  Â: "a",
  î: "i",
  Î: "i",
  û: "u",
  Û: "u",
};

export function normalizeTr(value: string): string {
  let out = "";
  for (const ch of value) {
    const lower = ch.toLowerCase();
    out += TURKISH_MAP[ch] ?? TURKISH_MAP[ch.toUpperCase()] ?? lower;
  }
  return out;
}

export function fuzzyScore(haystack: string, needle: string): FuzzyMatch | null {
  if (!needle) return { score: 0, indices: [] };
  const h = normalizeTr(haystack);
  const n = normalizeTr(needle);
  if (!n) return { score: 0, indices: [] };

  const direct = h.indexOf(n);
  if (direct === 0) return { score: 1000 - h.length, indices: range(0, n.length) };
  if (direct > 0) {
    const wordStart = direct === 0 || h[direct - 1] === " " || h[direct - 1] === "-";
    return {
      score: (wordStart ? 700 : 480) - direct - h.length * 0.1,
      indices: range(direct, direct + n.length),
    };
  }

  let hi = 0;
  let score = 0;
  let streak = 0;
  const indices: number[] = [];
  for (let ni = 0; ni < n.length; ni += 1) {
    const target = n[ni];
    let found = -1;
    while (hi < h.length) {
      if (h[hi] === target) {
        found = hi;
        break;
      }
      hi += 1;
    }
    if (found === -1) return null;
    indices.push(found);
    const previous = indices[indices.length - 2];
    if (previous !== undefined && found === previous + 1) {
      streak += 1;
      score += 18 + streak * 6;
    } else {
      streak = 0;
      score += 6;
    }
    if (found === 0 || h[found - 1] === " " || h[found - 1] === "-") score += 14;
    hi = found + 1;
  }
  score -= h.length * 0.12;
  score -= indices[0] ?? 0;
  return { score, indices };
}

function range(start: number, length: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < length; i += 1) out.push(start + i);
  return out;
}

export interface Ranked<T> {
  item: T;
  score: number;
  indices: number[];
}

export function fuzzyRank<T>(
  items: T[],
  needle: string,
  toText: (item: T) => string,
): Ranked<T>[] {
  const out: Ranked<T>[] = [];
  for (const item of items) {
    const match = fuzzyScore(toText(item), needle);
    if (match) {
      out.push({ item, score: match.score, indices: match.indices });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}
