import type { Note } from "../types";
import {
  BACKEND_CANISTER_ID,
  listNotes as canisterListNotes,
  addNote as canisterAddNote,
  editNote as canisterEditNote,
  togglePin as canisterTogglePin,
  removeNote as canisterRemoveNote,
} from "../thebes";

const LOCAL_STORAGE_KEY = `thebes-vault:${BACKEND_CANISTER_ID}`;

// Initial sample notes to provide immediate rich preview when canister is not yet deployed
const SEED_NOTES: Note[] = [
  {
    id: 1n,
    title: "Welcome to Thebes Notes ☥",
    body: `Welcome to your decentralized workspace running on the Thebes blockchain substrate.

- [x] Modern UI/UX redesign complete
- [x] Dual-theme light and dark mode
- [x] Memphis WebAuthn passkey authentication
- [ ] Deploy canister backend with thebes-deploy`,
    category: "Ideas",
    pinned: true,
    color: "#EAF2FF", // Soft Sky
    createdAt: BigInt((Date.now() - 3600000 * 2) * 1_000_000),
    updatedAt: BigInt((Date.now() - 3600000 * 2) * 1_000_000),
  },
  {
    id: 2n,
    title: "Orthogonal Persistence & Substrate",
    body: `Thebes smart contracts compile to wasm32-unknown-unknown with enhanced orthogonal persistence. State is stored natively in Motoko actor memory on WAN Experimental.

Canister ID: 55053167656008
Gateway: https://memphis.mercaturaforum.com`,
    category: "Work",
    pinned: true,
    color: "#EEF8EE", // Mint Sage
    createdAt: BigInt((Date.now() - 3600000 * 5) * 1_000_000),
    updatedAt: BigInt((Date.now() - 3600000 * 1) * 1_000_000),
  },
  {
    id: 3n,
    title: "Sprint Goals & Milestones",
    body: `Milestones for the upcoming protocol integration:

- [x] Responsive layout with Masonry Grid & List views
- [x] Instant search (⌘K) and category counters
- [x] Accessible dialogs with focus trapping
- [ ] Deploy Motoko canister wasm to network`,
    category: "Tasks",
    pinned: false,
    color: "#FFF7DD", // Sunlit Amber
    createdAt: BigInt((Date.now() - 86400000) * 1_000_000),
    updatedAt: BigInt((Date.now() - 3600000 * 3) * 1_000_000),
  },
  {
    id: 4n,
    title: "Design System & Color Tokens",
    body: `Crafted with Plus Jakarta Sans for titles, Inter for body copy, and Space Grotesk for metrics. Every note card tint adapts harmoniously across light and obsidian dark modes.`,
    category: "Personal",
    pinned: false,
    color: "#F4ECFF", // Lavender
    createdAt: BigInt((Date.now() - 86400000 * 2) * 1_000_000),
    updatedAt: BigInt((Date.now() - 86400000 * 2) * 1_000_000),
  },
];

interface SerializedNote {
  id: string;
  title: string;
  body: string;
  category: string;
  pinned: boolean;
  color: string;
  createdAt: string;
  updatedAt: string;
}

function loadLocalNotes(): Note[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      saveLocalNotes(SEED_NOTES);
      return SEED_NOTES;
    }
    const parsed = JSON.parse(raw) as SerializedNote[];
    return parsed.map((n) => ({
      id: BigInt(n.id),
      title: n.title,
      body: n.body,
      category: n.category,
      pinned: Boolean(n.pinned),
      color: n.color,
      createdAt: BigInt(n.createdAt),
      updatedAt: BigInt(n.updatedAt),
    }));
  } catch {
    return SEED_NOTES;
  }
}

function saveLocalNotes(notes: Note[]): void {
  try {
    const serialized: SerializedNote[] = notes.map((n) => ({
      id: n.id.toString(),
      title: n.title,
      body: n.body,
      category: n.category,
      pinned: n.pinned,
      color: n.color,
      createdAt: n.createdAt.toString(),
      updatedAt: n.updatedAt.toString(),
    }));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serialized));
  } catch {
    // localStorage may be disabled
  }
}

export interface VaultResponse {
  notes: Note[];
  isLocalDevMode: boolean;
  canisterStatus: "live" | "not_deployed" | "error";
  statusMessage?: string;
}

/**
 * Loads notes: attempts the live canister query first.
 * If the canister returns "method not found" (canister not deployed yet) or fails,
 * it seamlessly falls back to the browser vault.
 */
export async function getNotes(): Promise<VaultResponse> {
  try {
    const liveNotes = await canisterListNotes();
    return {
      notes: liveNotes,
      isLocalDevMode: false,
      canisterStatus: "live",
    };
  } catch (err) {
    const errStr = String(err);
    const isNotDeployed =
      errStr.includes("not found in canister") ||
      errStr.toLowerCase().includes("failed to fetch") ||
      errStr.includes("NetworkError");

    const localNotes = loadLocalNotes();

    return {
      notes: localNotes,
      isLocalDevMode: true,
      canisterStatus: isNotDeployed ? "not_deployed" : "error",
      statusMessage: errStr,
    };
  }
}

/**
 * Creates a note: tries on-chain canister first, falls back to local storage if in dev mode.
 */
export async function createNote(
  title: string,
  body: string,
  category: string,
  color: string,
  useLocalFallback: boolean
): Promise<bigint> {
  if (!useLocalFallback) {
    try {
      return await canisterAddNote(title, body, category, color);
    } catch (err) {
      const errStr = String(err);
      if (!errStr.includes("not found in canister")) {
        throw err;
      }
    }
  }

  // Local fallback
  const notes = loadLocalNotes();
  const maxId = notes.reduce((max, n) => (n.id > max ? n.id : max), 0n);
  const newId = maxId + 1n;
  const now = BigInt(Date.now() * 1_000_000);

  const newNote: Note = {
    id: newId,
    title,
    body,
    category,
    pinned: false,
    color,
    createdAt: now,
    updatedAt: now,
  };

  saveLocalNotes([newNote, ...notes]);
  return newId;
}

/**
 * Updates a note.
 */
export async function updateNote(
  id: bigint,
  title: string,
  body: string,
  category: string,
  color: string,
  useLocalFallback: boolean
): Promise<boolean> {
  if (!useLocalFallback) {
    try {
      return await canisterEditNote(id, title, body, category, color);
    } catch (err) {
      const errStr = String(err);
      if (!errStr.includes("not found in canister")) {
        throw err;
      }
    }
  }

  const notes = loadLocalNotes();
  const now = BigInt(Date.now() * 1_000_000);
  const updated = notes.map((n) =>
    n.id === id
      ? {
          ...n,
          title,
          body,
          category,
          color,
          updatedAt: now,
        }
      : n
  );

  saveLocalNotes(updated);
  return true;
}

/**
 * Toggles note pin status.
 */
export async function toggleNotePin(
  id: bigint,
  useLocalFallback: boolean
): Promise<boolean> {
  if (!useLocalFallback) {
    try {
      return await canisterTogglePin(id);
    } catch (err) {
      const errStr = String(err);
      if (!errStr.includes("not found in canister")) {
        throw err;
      }
    }
  }

  const notes = loadLocalNotes();
  const now = BigInt(Date.now() * 1_000_000);
  const updated = notes.map((n) =>
    n.id === id
      ? {
          ...n,
          pinned: !n.pinned,
          updatedAt: now,
        }
      : n
  );

  saveLocalNotes(updated);
  return true;
}

/**
 * Deletes a note.
 */
export async function deleteNote(
  id: bigint,
  useLocalFallback: boolean
): Promise<boolean> {
  if (!useLocalFallback) {
    try {
      return await canisterRemoveNote(id);
    } catch (err) {
      const errStr = String(err);
      if (!errStr.includes("not found in canister")) {
        throw err;
      }
    }
  }

  const notes = loadLocalNotes();
  const filtered = notes.filter((n) => n.id !== id);
  saveLocalNotes(filtered);
  return true;
}
