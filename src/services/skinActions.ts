import type { Chroma, Skin } from "@/types/champion";
import { ltkInstall } from "@/services/ltkManager";

export function skinPackageUrl(skin: Skin, chroma: Chroma | null): string | null {
  return chroma?.packageUrl ?? skin.packageUrl ?? null;
}

export async function applySkinToLtk(
  skin: Skin,
  chroma: Chroma | null,
): Promise<string> {
  const remoteUrl = skinPackageUrl(skin, chroma);
  if (!remoteUrl) {
    throw new Error("Bu kostüm için mod paketi bulunamadı.");
  }
  await ltkInstall(remoteUrl, skin.name, "VOID");
  return remoteUrl;
}
