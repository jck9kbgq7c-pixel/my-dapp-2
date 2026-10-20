import type { Note } from "./thebes";

export type { Note };

export type ViewMode = "grid" | "list";

export type SortOption = "updated_desc" | "created_desc" | "created_asc" | "title_asc";

export interface ToastMessage {
  id: string;
  type: "success" | "info" | "warning" | "error";
  title: string;
  message?: string;
  timestamp: number;
}

export interface NoteColorConfig {
  id: string;
  hex: string;
  name: string;
  bgLight: string;
  bgDark: string;
  borderLight: string;
  borderDark: string;
  accent: string;
  textLight: string;
  textDark: string;
}
