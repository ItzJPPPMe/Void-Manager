import type { Chroma, Skin } from "@/types/champion";
import { downloadToCache } from "@/services/ltkManager";
import {
  voidModsImportForSkin,
  voidModsSetEnabled,
  type VoidMod,
} from "@/services/voidEngine";
import { skinPackageUrl } from "@/services/skinActions";

export async function importSkinToVoid(
  skin: Skin,
  chroma: Chroma | null,
): Promise<VoidMod> {
  const remoteUrl = skinPackageUrl(skin, chroma);
  if (!remoteUrl) {
    throw new Error("Bu kostüm için mod paketi bulunamadı.");
  }
  const cleanUrl = remoteUrl.split("?")[0].split("#")[0];
  const extMatch = cleanUrl.match(/\.(fantome|zip|modpkg)$/i);
  const ext = extMatch ? extMatch[0] : ".fantome";
  const cacheKey = `packages/${skin.id}${chroma ? `-${chroma.id}` : ""}${ext}`;
  const localPath = await downloadToCache(remoteUrl, cacheKey, 0, true);
  const mod = await voidModsImportForSkin(localPath, skin.id);
  await voidModsSetEnabled(mod.id, true);
  return mod;
}

export async function importSkinsToVoid(
  skins: Skin[],
  onProgress?: (done: number, total: number, skin: Skin) => void,
): Promise<{ added: VoidMod[]; failed: { skin: Skin; error: string }[] }> {
  const added: VoidMod[] = [];
  const failed: { skin: Skin; error: string }[] = [];
  let done = 0;
  for (const skin of skins) {
    try {
      const mod = await importSkinToVoid(skin, null);
      added.push(mod);
    } catch (err) {
      failed.push({
        skin,
        error:
          typeof err === "string"
            ? err
            : err instanceof Error
              ? err.message
              : "Bilinmeyen hata",
      });
    }
    done += 1;
    onProgress?.(done, skins.length, skin);
  }
  return { added, failed };
}
