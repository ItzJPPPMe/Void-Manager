export type SkinSourceType = "bettie9" | "alban1911" | "darkseal" | "local";

export type SkinFilter = "all" | "favorites" | "ready" | "chromas";

export interface Chroma {
  id: number;
  name: string;
  color: string;
  colors: string[];
  imageUrl: string;
  owned: boolean;
  packageUrl: string | null;
}

export interface Skin {
  id: number;
  championId: number;
  championName: string;
  skinNum: number;
  name: string;
  description: string;
  rarity: string;
  isLegacy: boolean;
  isBase: boolean;
  chromas: Chroma[];
  splashUrl: string;
  tileUrl: string;
  loadScreenUrl: string;
  favorite: boolean;
  ready: boolean;
  packageUrl: string | null;
  sources: SkinSourceType[];
}

export interface ChampionSummary {
  id: number;
  key: string;
  name: string;
  title: string;
  iconUrl: string;
  skinCount: number;
}

export interface CommunityDragonSkin {
  id: number;
  name: string;
  isBase: boolean;
  splashPath: string;
  uncenteredSplashPath?: string;
  tilePath: string;
  loadScreenPath: string;
  chromaPath: string | null;
  rarity: string;
  isLegacy: boolean;
  description: string | null;
  skinClassification: string;
  chromas?: CommunityDragonChroma[];
}

export interface CommunityDragonChroma {
  id: number;
  name: string;
  chromaPath: string;
  tilePath: string;
  colors: string[];
  description: string;
}

export interface CommunityDragonChampionSummary {
  id: number;
  name: string;
  title: string;
  squarePortraitPath: string;
  roles?: string[];
}

export interface CommunityDragonSkinsResponse {
  [skinId: string]: CommunityDragonSkin;
}

export interface DdragonSkin {
  id: string;
  num: number;
  name: string;
}

export interface DdragonChampionFullEntry {
  id: string;
  key: string;
  name: string;
  title: string;
  skins: DdragonSkin[];
}

export interface DdragonChampionFullResponse {
  data: Record<string, DdragonChampionFullEntry>;
}
