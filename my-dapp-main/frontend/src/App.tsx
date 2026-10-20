import { useEffect, useMemo, useState } from "react";
import {
  addNote,
  editNote,
  getBalance,
  getFeed,
  getMyTips,
  listNotes,
  removeNote,
  tip,
  togglePin,
  toggleShare,
  getUsername,
  setPassword,
  removePassword,
} from "./thebes";
import type { FeedNote, TipRecord } from "./thebes";
import { useMemphisConnect } from "./lib/useMemphisConnect";
import type { MemphisConnectAuth } from "./lib/useMemphisConnect";
import {
  usePasswordSession,
  derivePasswordKey,
  isValidUsername,
  normalizeUsername,
  friendlyError,
  MIN_PASSWORD_LENGTH,
} from "./lib/usePasswordSession";
import "./App.css";

// ────────────────────────────────────────────────────────────
//  Types
// ────────────────────────────────────────────────────────────

type Note = {
  id: bigint;
  title: string;
  body: string;
  category: string;
  pinned: boolean;
  isShared: boolean;
  color: string;
  createdAt: bigint;
  updatedAt: bigint;
};

type ViewMode = "mine" | "feed" | "history";
type SortMode = "updated" | "created" | "title";
type LayoutMode = "grid" | "list";

// ────────────────────────────────────────────────────────────
//  Constants
// ────────────────────────────────────────────────────────────

const NOTE_COLORS = [
  "#f0eefd", // lavender
  "#e8f4ff", // sky blue
  "#edfaf2", // mint
  "#fff5e6", // peach
  "#fef2f2", // blush
  "#fffbeb", // cream
];

const NOTE_COLORS_DARK = [
  "#1e1b3a",
  "#172035",
  "#172a22",
  "#2b1f10",
  "#2a1616",
  "#252214",
];

const CATEGORIES = ["Personal", "Work", "Study", "Ideas", "Tasks", "Research"];

const CATEGORY_ICONS: Record<string, string> = {
  Personal: "👤",
  Work: "💼",
  Study: "📚",
  Ideas: "💡",
  Tasks: "✅",
  Research: "🔬",
  All: "📋",
};

// ────────────────────────────────────────────────────────────
//  Helpers
// ────────────────────────────────────────────────────────────

function formatDate(ts: bigint): string {
  try {
    const ms = Number(ts / 1_000_000n);
    const now = Date.now();
    const diff = now - ms;

    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;

    return new Date(ms).toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ────────────────────────────────────────────────────────────
//  Root component
// ────────────────────────────────────────────────────────────

export type ActiveSession = {
  method: "passkey" | "password";
  /** Token passed to every contract call (passkey token or password session token). */
  token: string;
  displayName: string;
  /** Only present for passkey sessions — needed to set or remove a password. */
  passkeyToken?: string;
  signOut: () => void;
};

export default function App() {
  const passkey = useMemphisConnect("my-dapp");
  const password = usePasswordSession();

  const signOutAll = () => {
    passkey.signOut();
    password.signOut();
  };

  let active: ActiveSession | null = null;
  if (passkey.signedIn && passkey.token) {
    active = {
      method: "passkey",
      token: passkey.token,
      displayName: passkey.displayName || "Passkey user",
      passkeyToken: passkey.token,
      signOut: signOutAll,
    };
  } else if (password.session) {
    active = {
      method: "password",
      token: password.session.token,
      displayName: password.session.username,
      signOut: signOutAll,
    };
  }

  if (!active) {
    return <ConnectGate passkey={passkey} password={password} />;
  }

  return <NotesApp key={active.token} tokenHex={active.token} session={active} />;
}

// ────────────────────────────────────────────────────────────
//  ConnectGate — sign-in screen shown while signed out
// ────────────────────────────────────────────────────────────

function ConnectGate({
  passkey,
  password,
}: {
  passkey: MemphisConnectAuth;
  password: ReturnType<typeof usePasswordSession>;
}) {
  const [method, setMethod] = useState<"passkey" | "password">("passkey");
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");

  return (
    <div className="page-root">
      <nav className="navbar" role="navigation" aria-label="Main navigation">
        <div className="navbar-brand">
          <div className="navbar-logo" aria-hidden="true">✦</div>
          <div className="navbar-brand-text">
            <span className="navbar-title">THEBES NOTES</span>
            <span className="navbar-subtitle">DAPP</span>
          </div>
        </div>
      </nav>

      <main className="page-content" role="main">
        <section className="auth-panel" aria-labelledby="auth-title">
          <h1 id="auth-title" className="auth-title">Sign in to Thebes Notes</h1>
          <p className="auth-desc">Your private, on-chain notes.</p>

          <div className="view-tabs" role="tablist" aria-label="Sign-in method">
            <button
              type="button"
              role="tab"
              aria-selected={method === "passkey"}
              className={`view-tab${method === "passkey" ? " active" : ""}`}
              onClick={() => setMethod("passkey")}
            >
              <span aria-hidden="true">⚷</span> Passkey
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={method === "password"}
              className={`view-tab${method === "password" ? " active" : ""}`}
              onClick={() => setMethod("password")}
            >
              <span aria-hidden="true">🔑</span> Username &amp; password
            </button>
          </div>

          {method === "passkey" ? (
            <div className="auth-form">
              {passkey.error && <p className="auth-error" role="alert">{passkey.error}</p>}
              <p className="auth-hint">
                Use your fingerprint, face or screen lock. A new name creates an
                account; an existing name signs in.
              </p>
              <button
                id="sign-in-btn"
                type="button"
                className="btn-primary"
                onClick={() => {
                  passkey.signIn({ mode: "auto" }).catch(() => {});
                }}
                disabled={passkey.busy}
              >
                <span aria-hidden="true">⚷</span>
                {passkey.busy ? "Signing in…" : "Sign in with passkey"}
              </button>
            </div>
          ) : (
            <form
              className="auth-form"
              onSubmit={(e) => {
                e.preventDefault();
                void password.signIn(username, pw).then(() => setPw(""));
              }}
            >
              {password.error && <p className="auth-error" role="alert">{password.error}</p>}
              <label className="auth-field">
                <span>Username</span>
                <input
                  className="auth-input"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </label>
              <label className="auth-field">
                <span>Password</span>
                <input
                  className="auth-input"
                  type="password"
                  autoComplete="current-password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  required
                />
              </label>
              <button
                id="password-sign-in-btn"
                type="submit"
                className="btn-primary"
                disabled={password.busy || !username.trim() || !pw}
              >
                {password.busy ? "Signing in…" : "Sign in"}
              </button>
              <p className="auth-hint">
                No username yet? Sign in with your passkey first, then open your
                account menu (top right) and choose a username and password.
              </p>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  Main app
// ────────────────────────────────────────────────────────────

function NotesApp({
  tokenHex,
  session,
}: {
  tokenHex: string;
  session: ActiveSession;
}) {
  // ── State ──────────────────────────────────────────────
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("Personal");
  const [color, setColor] = useState(NOTE_COLORS[0]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortMode, setSortMode] = useState<SortMode>("updated");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("grid");
  const [editingId, setEditingId] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<bigint | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [view, setView] = useState<ViewMode>("mine");
  const [showEditor, setShowEditor] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

  // Feed
  const [feedNotes, setFeedNotes] = useState<FeedNote[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [tipAmounts, setTipAmounts] = useState<Record<string, string>>({});
  const [tipBusyId, setTipBusyId] = useState<bigint | null>(null);

  // History
  const [history, setHistory] = useState<TipRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  // Balance
  const [balance, setBalance] = useState<bigint | null>(null);

  // ── Loaders ────────────────────────────────────────────

  async function loadBalance() {
    try {
      setBalance(await getBalance(tokenHex));
    } catch (e) {
      console.error(e);
    }
  }

  async function loadFeed() {
    try {
      setFeedError("");
      setFeedLoading(true);
      setFeedNotes(await getFeed(tokenHex));
    } catch (e) {
      setFeedError(String(e));
    } finally {
      setFeedLoading(false);
    }
  }

  async function loadHistory() {
    try {
      setHistoryError("");
      setHistoryLoading(true);
      setHistory(await getMyTips(tokenHex));
    } catch (e) {
      setHistoryError(String(e));
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadNotes() {
    try {
      setError("");
      setNotes(await listNotes(tokenHex));
    } catch (e) {
      // A password session the contract no longer knows (expired, or the
      // password was changed) falls through to the passkey check and fails.
      if (session.method === "password" && /Memphis:|session expired/i.test(String(e))) {
        session.signOut();
        return;
      }
      setError(String(e));
    }
  }

  // ── Effects ────────────────────────────────────────────

  useEffect(() => {
    void loadNotes();
    void loadBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenHex]);

  useEffect(() => {
    if (view === "feed") void loadFeed();
    if (view === "history") void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, tokenHex]);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
  }, [darkMode]);

  // Close editor on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showEditor) closeEditor();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        openNewEditor();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setView("mine");
        setTimeout(() => document.getElementById("notes-search")?.focus(), 0);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEditor]);

  // ── Derived ────────────────────────────────────────────

  const categories = useMemo(() => {
    const existing = notes.map((n) => n.category).filter(Boolean);
    return ["All", ...Array.from(new Set([...CATEGORIES, ...existing]))];
  }, [notes]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: notes.length };
    for (const note of notes) {
      counts[note.category] = (counts[note.category] ?? 0) + 1;
    }
    return counts;
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = notes.filter((note) => {
      const matchesSearch =
        !query ||
        note.title.toLowerCase().includes(query) ||
        note.body.toLowerCase().includes(query) ||
        note.category.toLowerCase().includes(query);
      const matchesCategory =
        selectedCategory === "All" || note.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    return [...filtered].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (sortMode === "updated") return Number(b.updatedAt - a.updatedAt);
      if (sortMode === "created") return Number(b.createdAt - a.createdAt);
      if (sortMode === "title") return a.title.localeCompare(b.title);
      return 0;
    });
  }, [notes, search, selectedCategory, sortMode]);

  const pinnedCount = notes.filter((n) => n.pinned).length;

  // ── Editor helpers ─────────────────────────────────────

  function openNewEditor() {
    setEditingId(null);
    setTitle("");
    setBody("");
    setCategory("Personal");
    setColor(NOTE_COLORS[0]);
    setError("");
    setShowEditor(true);
  }

  function startEdit(note: Note) {
    setEditingId(note.id);
    setTitle(note.title);
    setBody(note.body);
    setCategory(note.category);
    setColor(note.color);
    setError("");
    setShowEditor(true);
  }

  function closeEditor() {
    setShowEditor(false);
    setEditingId(null);
    setTitle("");
    setBody("");
    setCategory("Personal");
    setColor(NOTE_COLORS[0]);
    setError("");
  }

  // ── Actions ────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError("Please enter both a title and note content.");
      return;
    }
    try {
      setLoading(true);
      setError("");
      if (editingId !== null) {
        await editNote(tokenHex, editingId, title.trim(), body.trim(), category, color);
      } else {
        await addNote(tokenHex, title.trim(), body.trim(), category, color);
      }
      closeEditor();
      await loadNotes();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handlePin(id: bigint) {
    try {
      setLoading(true);
      await togglePin(tokenHex, id);
      await loadNotes();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleShare(id: bigint) {
    try {
      setLoading(true);
      await toggleShare(tokenHex, id);
      await loadNotes();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (deleteId === null) return;
    try {
      setLoading(true);
      await removeNote(tokenHex, deleteId);
      setDeleteId(null);
      await loadNotes();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleTip(noteId: bigint) {
    const raw = tipAmounts[noteId.toString()] ?? "";
    const parsed = Number(raw);
    if (!raw.trim() || !Number.isInteger(parsed) || parsed <= 0) {
      setFeedError("Enter a whole number of points greater than 0.");
      return;
    }
    try {
      setTipBusyId(noteId);
      setFeedError("");
      await tip(tokenHex, noteId, BigInt(parsed));
      setTipAmounts((prev) => ({ ...prev, [noteId.toString()]: "" }));
      await Promise.all([loadFeed(), loadBalance()]);
    } catch (e) {
      setFeedError(String(e));
    } finally {
      setTipBusyId(null);
    }
  }

  // ── Render ─────────────────────────────────────────────

  return (
    <div className="page-root">

      {/* ─── NAVBAR ─── */}
      <nav className="navbar" role="navigation" aria-label="Main navigation">
        <div className="navbar-brand">
          <div className="navbar-logo" aria-hidden="true">✦</div>
          <div className="navbar-brand-text">
            <span className="navbar-title">THEBES NOTES</span>
            <span className="navbar-subtitle">DAPP</span>
          </div>
        </div>

        <div className="navbar-meta">
          <div className="canister-chip" title="Canister online">
            <span className="canister-dot" aria-hidden="true" />
            Canister #55053...6008
          </div>
        </div>

        <div className="navbar-spacer" />

        <div className="navbar-actions">

          {/* Account: shows who is signed in, opens login settings */}
          <button
            id="identity-btn"
            type="button"
            className="btn-identity signed-in"
            onClick={() => setShowAccount(true)}
            aria-haspopup="dialog"
            aria-label={`Account: signed in as ${session.displayName}`}
            title="Account & login settings"
          >
            <span aria-hidden="true">{session.method === "passkey" ? "⚷" : "🔑"}</span>
            {session.displayName}
          </button>

          {/* Balance */}
          {balance !== null && (
            <div className="points-pill" title="Your point balance">
              ✦ {balance.toString()}<span> pts</span>
            </div>
          )}

          {/* Dark mode toggle */}
          <button
            id="theme-toggle-btn"
            type="button"
            className="btn-icon"
            onClick={() => setDarkMode((d) => !d)}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? "☀" : "☾"}
          </button>

          {/* New Note CTA */}
          <button
            id="new-note-btn"
            type="button"
            className="btn-primary"
            onClick={openNewEditor}
            aria-label="Create a new note"
          >
            <span aria-hidden="true">+</span>
            {showEditor && editingId === null ? "Writing Note" : "New Note"}
            <span className="btn-kbd">⌘N</span>
          </button>

        </div>
      </nav>

      {/* ─── PAGE CONTENT ─── */}
      <main className="page-content" role="main">

        {/* Error from notes operations */}
        {error && (
          <div className="error-banner" role="alert">
            <span aria-hidden="true">⚠</span>
            {error}
          </div>
        )}

        {/* ── STATS ── */}
        {view === "mine" && (
          <div className="stats-grid" role="region" aria-label="Statistics">
            <div className="stat-card">
              <div className="stat-icon-wrap" aria-hidden="true">✦</div>
              <div className="stat-body">
                <p className="stat-label">Total Notes</p>
                <div className="stat-value-row">
                  <span className="stat-value">{notes.length}</span>
                  <span className="stat-badge primary">On-chain</span>
                </div>
                <p className="stat-sub">
                  {notes.length === 1 ? "1 stored in canister" : `${notes.length} stored in canister`}
                </p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrap gold" aria-hidden="true">★</div>
              <div className="stat-body">
                <p className="stat-label">Starred &amp; Pinned</p>
                <div className="stat-value-row">
                  <span className="stat-value">{pinnedCount}</span>
                  {selectedCategory !== "All" && (
                    <span className="stat-badge gold">Filter</span>
                  )}
                </div>
                <p className="stat-sub">
                  {pinnedCount === 1 ? "1 prioritized item" : `${pinnedCount} prioritized items`}
                </p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrap green" aria-hidden="true">🏷</div>
              <div className="stat-body">
                <p className="stat-label">Categories</p>
                <div className="stat-value-row">
                  <span className="stat-value">{categories.length - 1}</span>
                  <span className="stat-badge green">
                    Active: {selectedCategory}
                  </span>
                </div>
                <p className="stat-sub">Organized across workspaces</p>
              </div>
            </div>
          </div>
        )}

        {/* ── QUICK NOTE BAR (only on My Notes view) ── */}
        {view === "mine" && !showEditor && (
          <div
            className="quick-note-bar"
            role="button"
            tabIndex={0}
            onClick={openNewEditor}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") openNewEditor();
            }}
            aria-label="Create a new note"
          >
            <span className="quick-note-icon" aria-hidden="true">✦</span>
            <span className="quick-note-input" style={{ color: "var(--text-muted)" }}>
              Take a note… or jot down your decentralized thoughts
            </span>
            <span className="quick-note-kbd">⌘N</span>
          </div>
        )}

        {/* ── VIEW TABS ── */}
        <div className="view-tabs" role="tablist" aria-label="View tabs">
          {(["mine", "feed", "history"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              className={`view-tab${view === v ? " active" : ""}`}
              onClick={() => setView(v)}
            >
              {v === "mine" && <span aria-hidden="true">📋</span>}
              {v === "feed" && <span aria-hidden="true">📡</span>}
              {v === "history" && <span aria-hidden="true">📜</span>}
              {v === "mine" ? "My Notes" : v === "feed" ? "Feed" : "History"}
            </button>
          ))}
        </div>

        {/* ─────────── VIEWS ─────────── */}

        {view === "feed" ? (
          <FeedSection
            notes={feedNotes}
            loading={feedLoading}
            error={feedError}
            tipAmounts={tipAmounts}
            onTipAmountChange={(id, value) =>
              setTipAmounts((prev) => ({ ...prev, [id]: value }))
            }
            onTip={handleTip}
            tipBusyId={tipBusyId}
          />
        ) : view === "history" ? (
          <HistorySection
            tips={history}
            loading={historyLoading}
            error={historyError}
          />
        ) : (
          /* ─── MY NOTES VIEW ─── */
          <>
            {/* Toolbar */}
            <div className="notes-toolbar" role="search">
              {/* Search */}
              <div className="search-box">
                <span className="search-icon" aria-hidden="true">⌕</span>
                <input
                  id="notes-search"
                  className="search-input"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search notes, tags, ideas…"
                  aria-label="Search notes"
                />
                {search ? (
                  <button
                    type="button"
                    className="search-clear"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                ) : (
                  <span className="search-kbd">⌘K</span>
                )}
              </div>

              {/* Sort */}
              <div className="sort-select-wrap">
                <span className="sort-icon" aria-hidden="true" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", zIndex: 1 }}>⇅</span>
                <select
                  id="sort-select"
                  className="sort-select"
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  aria-label="Sort notes by"
                  style={{ paddingLeft: 32 }}
                >
                  <option value="updated">Recently Updated</option>
                  <option value="created">Recently Created</option>
                  <option value="title">Title A–Z</option>
                </select>
                <span className="sort-select-arrow" aria-hidden="true">▾</span>
              </div>

              {/* Layout toggle */}
              <div className="view-toggle" role="group" aria-label="Layout view">
                <button
                  type="button"
                  className={`view-toggle-btn${layoutMode === "grid" ? " active" : ""}`}
                  onClick={() => setLayoutMode("grid")}
                  aria-label="Grid view"
                  aria-pressed={layoutMode === "grid"}
                >
                  ⊞
                </button>
                <button
                  type="button"
                  className={`view-toggle-btn${layoutMode === "list" ? " active" : ""}`}
                  onClick={() => setLayoutMode("list")}
                  aria-label="List view"
                  aria-pressed={layoutMode === "list"}
                >
                  ≡
                </button>
              </div>
            </div>

            {/* Category filter chips */}
            <div className="category-bar" role="group" aria-label="Filter by category">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`category-chip${selectedCategory === cat ? " active" : ""}`}
                  onClick={() => setSelectedCategory(cat)}
                  aria-pressed={selectedCategory === cat}
                >
                  {CATEGORY_ICONS[cat] ?? "📂"} {cat}
                  <span className="chip-count">{categoryCounts[cat] ?? 0}</span>
                </button>
              ))}
              <span className="results-count" aria-live="polite">
                Showing {filteredNotes.length} result{filteredNotes.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Notes */}
            {filteredNotes.length === 0 ? (
              <div className="empty-state" role="status">
                <div className="empty-icon-wrap" aria-hidden="true">
                  {search ? "⌕" : "✦"}
                </div>
                <h2 className="empty-title">
                  {search ? "No matching notes" : "Your space is empty"}
                </h2>
                <p className="empty-desc">
                  {search
                    ? "Try a different search term or select another category."
                    : "Create your first note to get started."}
                </p>
              </div>
            ) : (
              <div
                className={layoutMode === "grid" ? "notes-grid" : "notes-list"}
                role="list"
                aria-label="Notes"
              >
                {filteredNotes.map((note) => (
                  <NoteCard
                    key={note.id.toString()}
                    note={note}
                    darkMode={darkMode}
                    loading={loading}
                    onPin={handlePin}
                    onShare={handleShare}
                    onEdit={startEdit}
                    onDelete={(id) => setDeleteId(id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

      </main>

      {/* ─── NOTE EDITOR OVERLAY ─── */}
      {showEditor && (
        <NoteEditor
          editingId={editingId}
          title={title}
          body={body}
          category={category}
          color={color}
          categories={categories.filter((c) => c !== "All")}
          loading={loading}
          error={error}
          onTitleChange={setTitle}
          onBodyChange={setBody}
          onCategoryChange={setCategory}
          onColorChange={setColor}
          onSubmit={handleSubmit}
          onClose={closeEditor}
        />
      )}

      {/* ─── ACCOUNT MODAL ─── */}
      {showAccount && (
        <AccountModal session={session} onClose={() => setShowAccount(false)} />
      )}

      {/* ─── DELETE MODAL ─── */}
      {deleteId !== null && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          onClick={() => setDeleteId(null)}
        >
          <div
            className="delete-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="delete-modal-icon" aria-hidden="true">🗑</div>
            <p className="delete-modal-eyebrow">Delete Note</p>
            <h2 id="delete-modal-title" className="delete-modal-title">
              Are you sure?
            </h2>
            <p className="delete-modal-desc">
              This note will be permanently removed from your on-chain collection. This action cannot be undone.
            </p>
            <div className="delete-modal-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setDeleteId(null)}
              >
                Keep Note
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={confirmDelete}
                disabled={loading}
              >
                {loading ? "Deleting…" : "🗑 Delete Note"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  AccountModal — who is signed in + username/password settings
// ────────────────────────────────────────────────────────────

function AccountModal({
  session,
  onClose,
}: {
  session: ActiveSession;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState<string | null>(null); // null = loading
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getUsername(session.token)
      .then((u) => {
        if (cancelled) return;
        setCurrent(u);
        setUsername(u);
      })
      .catch(() => {
        if (!cancelled) setCurrent("");
      });
    return () => {
      cancelled = true;
    };
  }, [session.token]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setFormError("");

    const u = normalizeUsername(username);
    if (!isValidUsername(u)) {
      setFormError("Usernames are 3–32 characters: a–z, 0–9, dot, dash or underscore.");
      return;
    }
    if (pw.length < MIN_PASSWORD_LENGTH) {
      setFormError(`Use at least ${MIN_PASSWORD_LENGTH} characters for the password.`);
      return;
    }
    if (pw !== pw2) {
      setFormError("The two passwords don't match.");
      return;
    }
    if (!session.passkeyToken) return;

    try {
      setBusy(true);
      const key = await derivePasswordKey(u, pw);
      await setPassword(session.passkeyToken, u, key);
      setCurrent(u);
      setUsername(u);
      setPw("");
      setPw2("");
      setMessage(`Saved. You can now sign in as “${u}” with this password.`);
    } catch (err) {
      setFormError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!session.passkeyToken) return;
    setMessage("");
    setFormError("");
    try {
      setBusy(true);
      await removePassword(session.passkeyToken);
      setCurrent("");
      setUsername("");
      setMessage("Username and password removed. Use your passkey to sign in.");
    } catch (err) {
      setFormError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
      onClick={onClose}
    >
      <div className="delete-modal account-modal" onClick={(e) => e.stopPropagation()}>
        <p className="delete-modal-eyebrow">Account</p>
        <h2 id="account-modal-title" className="delete-modal-title">
          {session.displayName}
        </h2>
        <p className="delete-modal-desc">
          Signed in with {session.method === "passkey" ? "your passkey" : "username & password"}.
        </p>

        <div className="account-section">
          <h3 className="account-section-title">Username &amp; password</h3>

          {current === null ? (
            <p className="auth-hint">Loading…</p>
          ) : session.method === "password" ? (
            <p className="auth-hint">
              To change or remove your password, sign out and sign in with your passkey.
            </p>
          ) : (
            <form className="auth-form" onSubmit={handleSave} noValidate>
              <p className="auth-hint">
                {current
                  ? <>Your username is <strong>{current}</strong>. Enter a new password to change it.</>
                  : "Add a username and password so you can also sign in without your passkey."}
              </p>
              {formError && <p className="auth-error" role="alert">{formError}</p>}
              {message && <p className="auth-success" role="status">{message}</p>}
              <label className="auth-field">
                <span>Username</span>
                <input
                  className="auth-input"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </label>
              <label className="auth-field">
                <span>{current ? "New password" : "Password"}</span>
                <input
                  className="auth-input"
                  type="password"
                  autoComplete="new-password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                />
              </label>
              <label className="auth-field">
                <span>Confirm password</span>
                <input
                  className="auth-input"
                  type="password"
                  autoComplete="new-password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                />
              </label>
              <div className="account-actions">
                {current && (
                  <button type="button" className="btn-cancel" onClick={handleRemove} disabled={busy}>
                    Remove password
                  </button>
                )}
                <button type="submit" className="btn-save" disabled={busy || !username.trim() || !pw}>
                  {busy ? "Saving…" : current ? "Change password" : "Save"}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="delete-modal-actions">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn-danger" onClick={session.signOut}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  NoteCard component
// ────────────────────────────────────────────────────────────

function NoteCard({
  note,
  darkMode,
  loading,
  onPin,
  onShare,
  onEdit,
  onDelete,
}: {
  note: Note;
  darkMode: boolean;
  loading: boolean;
  onPin: (id: bigint) => void;
  onShare: (id: bigint) => void;
  onEdit: (note: Note) => void;
  onDelete: (id: bigint) => void;
}) {
  const bgColor = darkMode
    ? NOTE_COLORS_DARK[NOTE_COLORS.indexOf(note.color)] ?? "#1e1b3a"
    : note.color;

  const wasEdited = note.updatedAt !== note.createdAt;
  const catIcon = CATEGORY_ICONS[note.category] ?? "📂";

  return (
    <article
      className={`note-card${note.pinned ? " is-pinned" : ""}`}
      style={{ backgroundColor: bgColor }}
      role="listitem"
      aria-label={`Note: ${note.title}`}
    >
      {/* Header row */}
      <div className="note-card-header">
        <div className="note-cat-badge">
          <span className="note-cat-icon" aria-hidden="true">{catIcon}</span>
          {note.category}
          {note.isShared && (
            <span className="shared-badge">
              <span aria-hidden="true">↗</span> Shared
            </span>
          )}
        </div>

        <button
          type="button"
          className={`note-pin-btn${note.pinned ? " pinned" : ""}`}
          onClick={() => onPin(note.id)}
          disabled={loading}
          aria-label={note.pinned ? "Unpin note" : "Pin note"}
          aria-pressed={note.pinned}
        >
          {note.pinned ? "★" : "☆"}
        </button>
      </div>

      {/* Title */}
      <h3 className="note-title">{note.title}</h3>

      {/* Body preview */}
      <p className="note-body-preview">{note.body}</p>

      {/* Footer */}
      <div className="note-footer">
        <span className="note-timestamp">
          {wasEdited ? "Edited" : "Created"} {formatDate(note.updatedAt)}
        </span>

        <div className="note-actions" aria-label="Note actions">
          {/* Copy (decorative) */}
          <button
            type="button"
            className="note-action-btn"
            aria-label="Copy note"
            onClick={() => {
              navigator.clipboard.writeText(`${note.title}\n\n${note.body}`).catch(() => {});
            }}
          >
            ⎘
          </button>

          {/* Expand (alias for edit) */}
          <button
            type="button"
            className="note-action-btn"
            aria-label="View note full-screen"
            onClick={() => onEdit(note)}
          >
            ↗
          </button>

          {/* Share to / remove from the public Feed */}
          <button
            type="button"
            className="note-action-btn share-btn"
            aria-label={note.isShared ? "Unshare note from Feed" : "Share note to Feed"}
            title={note.isShared ? "Unshare from Feed" : "Share to Feed"}
            aria-pressed={note.isShared}
            onClick={() => onShare(note.id)}
            disabled={loading}
          >
            {note.isShared ? "⊘" : "📡"}
          </button>

          {/* Edit */}
          <button
            type="button"
            className="note-action-btn edit-btn"
            aria-label="Edit note"
            onClick={() => onEdit(note)}
          >
            ✎
          </button>

          {/* Delete */}
          <button
            type="button"
            className="note-action-btn delete-btn"
            aria-label="Delete note"
            onClick={() => onDelete(note.id)}
            disabled={loading}
          >
            🗑
          </button>
        </div>
      </div>
    </article>
  );
}

// ────────────────────────────────────────────────────────────
//  NoteEditor overlay
// ────────────────────────────────────────────────────────────

function NoteEditor({
  editingId,
  title,
  body,
  category,
  color,
  categories,
  loading,
  error,
  onTitleChange,
  onBodyChange,
  onCategoryChange,
  onColorChange,
  onSubmit,
  onClose,
}: {
  editingId: bigint | null;
  title: string;
  body: string;
  category: string;
  color: string;
  categories: string[];
  loading: boolean;
  error: string;
  onTitleChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onColorChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  const wc = wordCount(body);
  const chars = body.length;

  return (
    <div
      className="editor-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="editor-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        className="editor-card"
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          // ⌘↵ / Ctrl+↵ saves, as the footer hint promises
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.requestSubmit();
          }
        }}
        noValidate
      >
        {/* Top bar */}
        <div className="editor-top-bar">
          <div className="editor-label">
            <span aria-hidden="true">✦</span>
            {editingId !== null ? "Edit On-Chain Note" : "New On-Chain Note"}
          </div>
          <button
            type="button"
            className="editor-close-btn"
            onClick={onClose}
            aria-label="Close editor"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="editor-body">
          {error && (
            <div className="error-banner" role="alert">
              <span aria-hidden="true">⚠</span> {error}
            </div>
          )}

          {/* Title */}
          <textarea
            id="editor-title"
            className="editor-title-input"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Note title…"
            rows={1}
            aria-label="Note title"
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = t.scrollHeight + "px";
            }}
            style={{ overflow: "hidden", resize: "none" }}
          />

          {/* Format bar */}
          <div className="editor-format-bar" aria-label="Formatting hints" role="toolbar">
            <button type="button" className="editor-format-btn" tabIndex={-1}>
              𝐁 Bold
            </button>
            <button type="button" className="editor-format-btn" tabIndex={-1}>
              ☑ Checklist
            </button>
            <button type="button" className="editor-format-btn" tabIndex={-1}>
              • Bullet
            </button>
            <span className="editor-format-sep" aria-hidden="true" />
            <button type="button" className="editor-format-btn" tabIndex={-1}>
              {"<>"} Code
            </button>
          </div>

          {/* Body textarea */}
          <textarea
            id="editor-body"
            className="editor-textarea"
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            placeholder="Start writing… Markdown supported"
            rows={8}
            aria-label="Note content"
          />

          {/* Meta row */}
          <div className="editor-meta-row">
            <div className="editor-meta-group">
              <span className="editor-meta-label">Category</span>
              <select
                id="editor-category"
                className="editor-category-select"
                value={category}
                onChange={(e) => onCategoryChange(e.target.value)}
                aria-label="Note category"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_ICONS[c] ?? "📂"} {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="editor-meta-group">
              <span className="editor-meta-label">Card Tint</span>
              <div className="editor-color-dots" role="radiogroup" aria-label="Note color">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={color === c}
                    className={`color-dot${color === c ? " selected" : ""}`}
                    style={{ backgroundColor: c }}
                    onClick={() => onColorChange(c)}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="editor-footer">
          <span className="editor-word-count">
            {wc} word{wc !== 1 ? "s" : ""} · {chars} chars
            {(wc > 0 || chars > 0) && <> · Press ⌘↵ to save</>}
          </span>
          <div className="editor-footer-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-save"
              disabled={loading || !title.trim() || !body.trim()}
            >
              <span aria-hidden="true">✦</span>
              {loading ? "Saving…" : editingId !== null ? "Save Changes" : "Create Note"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  FeedSection
// ────────────────────────────────────────────────────────────

function FeedSection({
  notes,
  loading,
  error,
  tipAmounts,
  onTipAmountChange,
  onTip,
  tipBusyId,
}: {
  notes: FeedNote[];
  loading: boolean;
  error: string;
  tipAmounts: Record<string, string>;
  onTipAmountChange: (id: string, value: string) => void;
  onTip: (id: bigint) => void;
  tipBusyId: bigint | null;
}) {
  return (
    <section className="feed-section" aria-labelledby="feed-title">
      <div className="section-header">
        <div>
          <p className="section-eyebrow">Public</p>
          <h2 id="feed-title" className="section-title">Community Feed</h2>
        </div>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          <span aria-hidden="true">⚠</span> {error}
        </div>
      )}

      {loading ? (
        <div className="loading-state" role="status" aria-label="Loading feed">
          <div className="loading-spinner" aria-hidden="true" />
          <span>Loading feed…</span>
        </div>
      ) : notes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon-wrap" aria-hidden="true">📡</div>
          <h3 className="empty-title">Nothing shared yet</h3>
          <p className="empty-desc">
            When someone shares a note, it will appear here.
          </p>
        </div>
      ) : (
        <div className="notes-grid" role="list" aria-label="Public notes">
          {[...notes]
            .sort((a, b) => Number(b.updatedAt - a.updatedAt))
            .map((note) => (
              <article
                key={note.id.toString()}
                className="note-card"
                style={{ backgroundColor: note.color }}
                role="listitem"
              >
                <div className="note-card-header">
                  <div className="note-cat-badge">
                    {CATEGORY_ICONS[note.category] ?? "📂"} {note.category}
                  </div>
                </div>

                <h3 className="note-title">{note.title}</h3>
                <p className="note-body-preview">{note.body}</p>

                <div className="note-footer">
                  <span className="feed-note-author">by {note.author}</span>
                </div>

                {/* Tip row */}
                <div className="tip-row">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    className="tip-input"
                    placeholder="Points"
                    value={tipAmounts[note.id.toString()] ?? ""}
                    onChange={(e) =>
                      onTipAmountChange(note.id.toString(), e.target.value)
                    }
                    disabled={tipBusyId !== null}
                    aria-label={`Tip amount for note: ${note.title}`}
                  />
                  <button
                    type="button"
                    className="tip-btn"
                    onClick={() => onTip(note.id)}
                    disabled={tipBusyId !== null}
                  >
                    {tipBusyId === note.id ? "Sending…" : "✦ Tip"}
                  </button>
                </div>
              </article>
            ))}
        </div>
      )}
    </section>
  );
}

// ────────────────────────────────────────────────────────────
//  HistorySection
// ────────────────────────────────────────────────────────────

function HistorySection({
  tips,
  loading,
  error,
}: {
  tips: TipRecord[];
  loading: boolean;
  error: string;
}) {
  return (
    <section aria-labelledby="history-title">
      <div className="section-header">
        <div>
          <p className="section-eyebrow">Activity</p>
          <h2 id="history-title" className="section-title">Tip History</h2>
        </div>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          <span aria-hidden="true">⚠</span> {error}
        </div>
      )}

      {loading ? (
        <div className="loading-state" role="status" aria-label="Loading history">
          <div className="loading-spinner" aria-hidden="true" />
          <span>Loading history…</span>
        </div>
      ) : tips.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon-wrap" aria-hidden="true">📜</div>
          <h3 className="empty-title">No tips yet</h3>
          <p className="empty-desc">
            Points you send or receive will appear here.
          </p>
        </div>
      ) : (
        <div className="history-list" role="list" aria-label="Tip history">
          {[...tips]
            .sort((a, b) => Number(b.timestamp - a.timestamp))
            .map((entry, index) => (
              <div className="history-row" key={index} role="listitem">
                <span className="history-amount">
                  ✦ {entry.amount.toString()} pts
                </span>
                <span className="history-detail">
                  {entry.from} → {entry.to} · note #{entry.noteId.toString()}
                </span>
                <span className="history-date">
                  {formatDate(entry.timestamp)}
                </span>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}