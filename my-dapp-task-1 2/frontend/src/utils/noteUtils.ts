import type { NoteColorConfig } from "../types";

export const NOTE_COLOR_CONFIGS: NoteColorConfig[] = [
  {
    id: "sand",
    hex: "#F7F3E8",
    name: "Warm Sand",
    bgLight: "#FAF7EF",
    bgDark: "rgba(247, 243, 232, 0.05)",
    borderLight: "rgba(217, 196, 153, 0.45)",
    borderDark: "rgba(247, 243, 232, 0.15)",
    accent: "#D97706",
    textLight: "#451A03",
    textDark: "#FDE68A",
  },
  {
    id: "sky",
    hex: "#EAF2FF",
    name: "Soft Sky",
    bgLight: "#F0F5FF",
    bgDark: "rgba(234, 242, 255, 0.05)",
    borderLight: "rgba(147, 197, 253, 0.45)",
    borderDark: "rgba(147, 197, 253, 0.15)",
    accent: "#2563EB",
    textLight: "#1E3A8A",
    textDark: "#93C5FD",
  },
  {
    id: "mint",
    hex: "#EEF8EE",
    name: "Mint Sage",
    bgLight: "#F2FAF2",
    bgDark: "rgba(238, 248, 238, 0.05)",
    borderLight: "rgba(134, 239, 172, 0.45)",
    borderDark: "rgba(134, 239, 172, 0.15)",
    accent: "#059669",
    textLight: "#064E3B",
    textDark: "#86EFAC",
  },
  {
    id: "rose",
    hex: "#FFF0F0",
    name: "Blush Rose",
    bgLight: "#FFF5F5",
    bgDark: "rgba(255, 240, 240, 0.05)",
    borderLight: "rgba(253, 164, 175, 0.45)",
    borderDark: "rgba(253, 164, 175, 0.15)",
    accent: "#E11D48",
    textLight: "#881337",
    textDark: "#FDA4AF",
  },
  {
    id: "lavender",
    hex: "#F4ECFF",
    name: "Lavender",
    bgLight: "#F7F1FF",
    bgDark: "rgba(244, 236, 255, 0.05)",
    borderLight: "rgba(216, 180, 254, 0.45)",
    borderDark: "rgba(216, 180, 254, 0.15)",
    accent: "#7C3AED",
    textLight: "#4C1D95",
    textDark: "#D8B4FE",
  },
  {
    id: "amber",
    hex: "#FFF7DD",
    name: "Sunlit Amber",
    bgLight: "#FFFBEB",
    bgDark: "rgba(255, 247, 221, 0.05)",
    borderLight: "rgba(252, 211, 77, 0.45)",
    borderDark: "rgba(252, 211, 77, 0.15)",
    accent: "#D97706",
    textLight: "#78350F",
    textDark: "#FDE68A",
  },
];

export const DEFAULT_NOTE_COLORS = NOTE_COLOR_CONFIGS.map((c) => c.hex);

export const DEFAULT_CATEGORIES = [
  "Personal",
  "Work",
  "Study",
  "Ideas",
  "Tasks",
  "Research",
];

export function getColorConfig(colorHex: string): NoteColorConfig {
  const found = NOTE_COLOR_CONFIGS.find(
    (c) => c.hex.toLowerCase() === colorHex.toLowerCase()
  );
  return found || NOTE_COLOR_CONFIGS[0];
}

export function getNoteStats(title: string, body: string): {
  words: number;
  chars: number;
  readingTimeMin: number;
} {
  const combined = `${title} ${body}`.trim();
  const chars = combined.length;
  const words = combined ? combined.split(/\s+/).filter(Boolean).length : 0;
  const readingTimeMin = Math.max(1, Math.ceil(words / 200));

  return { words, chars, readingTimeMin };
}

export function formatCategoryName(name: string): string {
  if (!name) return "General";
  return name.trim();
}
