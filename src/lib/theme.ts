import type { AppSettings, ThemeAccent } from "@/types/settings";

export const ACCENT_PRESETS: { id: ThemeAccent; label: string; hex: string }[] = [
  { id: "cyan", label: "Cyan", hex: "#00f0ff" },
  { id: "violet", label: "Violet", hex: "#8b5cf6" },
  { id: "magenta", label: "Magenta", hex: "#ff2e88" },
  { id: "lime", label: "Lime", hex: "#a3ff12" },
];

export function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (full.length !== 6) return "0 240 255";
  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value)) return "0 240 255";
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
}

export function isValidHex(value: string): boolean {
  return /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

export function applyTheme(settings: AppSettings): void {
  const root = document.documentElement;
  if (settings.customAccent && isValidHex(settings.customAccent)) {
    root.dataset.accent = "custom";
    root.style.setProperty("--accent-rgb", hexToRgb(settings.customAccent));
  } else {
    root.dataset.accent = settings.themeAccent;
    root.style.removeProperty("--accent-rgb");
  }
  root.style.setProperty("--glow-scale", String(settings.glowIntensity / 55));
  root.dataset.radius = settings.uiRadius;
  root.dataset.animations = settings.animationsEnabled ? "on" : "off";
  root.style.setProperty("--motion-speed", String(Math.max(0.25, settings.animationSpeed)));
}
