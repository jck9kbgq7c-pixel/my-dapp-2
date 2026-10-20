import { useState, useEffect, useMemo, useCallback } from "react";
import { useTheme } from "./useTheme";
import { useMemphis } from "./useMemphis";

import {
  getNotes,
  createNote,
  updateNote,
  toggleNotePin,
  deleteNote,
} from "./utils/vaultService";

import { Navbar } from "./components/Navbar";
import { StatsOverview } from "./components/StatsOverview";
import { FilterToolbar } from "./components/FilterToolbar";
import { NoteEditor } from "./components/NoteEditor";
import { NoteCard } from "./components/NoteCard";
import { NoteDetailModal } from "./components/NoteDetailModal";
import { DeleteModal } from "./components/DeleteModal";
import { MemphisModal } from "./components/MemphisModal";
import { ToastContainer } from "./components/Toast";
import { SkeletonGrid } from "./components/SkeletonCard";
import { EmptyState } from "./components/EmptyState";
import { RefreshIcon, SparklesIcon, CloseIcon, WarningIcon } from "./components/Icons";

import type { Note, ViewMode, SortOption, ToastMessage } from "./types";
import { DEFAULT_CATEGORIES } from "./utils/noteUtils";

export default function App() {
  const { effective: effectiveTheme, toggle: toggleTheme } = useTheme();
  const auth = useMemphis();

  // Data state
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isLocalDevMode, setIsLocalDevMode] = useState(false);
  const [canisterStatus, setCanisterStatus] = useState<"live" | "not_deployed" | "error">("live");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);

  // Filters and presentation
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [filterPinnedOnly, setFilterPinnedOnly] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>("updated_desc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Interaction modals and editors
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [detailNote, setDetailNote] = useState<Note | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);
  const [isMemphisModalOpen, setIsMemphisModalOpen] = useState(false);

  // Toast feedback
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (
      title: string,
      message?: string,
      type: "success" | "error" | "warning" | "info" = "success"
    ) => {
      const newToast: ToastMessage = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        type,
        title,
        message,
        timestamp: Date.now(),
      };
      setToasts((prev) => [...prev.slice(-4), newToast]);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Fetch notes via vaultService (checks on-chain canister first, falls back to browser vault)
  const fetchNotes = useCallback(
    async (showLoadingState = true) => {
      if (showLoadingState) setLoadingInitial(true);

      try {
        const res = await getNotes();
        setNotes(res.notes);
        setIsLocalDevMode(res.isLocalDevMode);
        setCanisterStatus(res.canisterStatus);
        setStatusMessage(res.statusMessage || null);

        if (showLoadingState && !res.isLocalDevMode && res.canisterStatus === "live") {
          addToast("Connected to Canister", "Live smart contract query successful.", "success");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatusMessage(msg);
        setCanisterStatus("error");
      } finally {
        setLoadingInitial(false);
      }
    },
    [addToast]
  );

  useEffect(() => {
    void fetchNotes();
  }, [fetchNotes]);

  // Keyboard shortcuts (Cmd+K for search, Cmd+N for new note)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>(".search-input");
        searchInput?.focus();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setIsEditorOpen((prev) => !prev);
        setEditingNote(null);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Category list and counts
  const { categories, categoryCounts } = useMemo(() => {
    const counts: Record<string, number> = { All: notes.length };

    notes.forEach((note) => {
      const cat = note.category?.trim() || "General";
      counts[cat] = (counts[cat] || 0) + 1;
    });

    const activeSet = new Set([
      ...DEFAULT_CATEGORIES,
      ...notes.map((n) => n.category?.trim()).filter(Boolean),
    ]);

    return {
      categories: ["All", ...Array.from(activeSet)],
      categoryCounts: counts,
    };
  }, [notes]);

  // Filtered and sorted notes
  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase();

    const result = notes.filter((note) => {
      const matchesSearch =
        !query ||
        note.title.toLowerCase().includes(query) ||
        note.body.toLowerCase().includes(query) ||
        note.category.toLowerCase().includes(query);

      const matchesCategory =
        selectedCategory === "All" ||
        (note.category?.trim() || "General") === selectedCategory;

      const matchesPinned = !filterPinnedOnly || note.pinned;

      return matchesSearch && matchesCategory && matchesPinned;
    });

    return [...result].sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }

      switch (sortOption) {
        case "created_desc":
          return Number(b.createdAt - a.createdAt);
        case "created_asc":
          return Number(a.createdAt - b.createdAt);
        case "title_asc":
          return a.title.localeCompare(b.title);
        case "updated_desc":
        default:
          return Number(b.updatedAt - a.updatedAt);
      }
    });
  }, [notes, search, selectedCategory, filterPinnedOnly, sortOption]);

  const pinnedCount = useMemo(() => notes.filter((n) => n.pinned).length, [notes]);

  // Create or Update note
  const handleSaveNote = async (data: {
    title: string;
    body: string;
    category: string;
    color: string;
  }) => {
    try {
      setActionLoading(true);

      if (editingNote) {
        await updateNote(
          editingNote.id,
          data.title,
          data.body,
          data.category,
          data.color,
          isLocalDevMode
        );
        addToast("Note Updated", `"${data.title}" updated successfully.`);
      } else {
        await createNote(
          data.title,
          data.body,
          data.category,
          data.color,
          isLocalDevMode
        );
        addToast(
          "Note Created",
          isLocalDevMode
            ? `"${data.title}" saved to local vault.`
            : `"${data.title}" stored on canister.`,
          "success"
        );
      }

      setIsEditorOpen(false);
      setEditingNote(null);
      await fetchNotes(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast("Failed to save note", msg, "error");
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle pin
  const handleTogglePin = async (id: bigint) => {
    const target = notes.find((n) => n.id === id);
    const willPin = target ? !target.pinned : false;

    // Optimistic update
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n))
    );

    try {
      await toggleNotePin(id, isLocalDevMode);
      addToast(
        willPin ? "Note Pinned" : "Note Unpinned",
        willPin ? "Pinned to top of your workspace." : "Unpinned from top."
      );
      await fetchNotes(false);
    } catch (err) {
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, pinned: !willPin } : n))
      );
      const msg = err instanceof Error ? err.message : String(err);
      addToast("Failed to update pin state", msg, "error");
    }
  };

  // Start edit
  const handleStartEdit = (note: Note) => {
    setEditingNote(note);
    setIsEditorOpen(true);
    setDetailNote(null);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // Delete note
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setActionLoading(true);
      await deleteNote(deleteTarget.id, isLocalDevMode);

      addToast("Note Deleted", `"${deleteTarget.title}" was permanently removed.`);
      setDeleteTarget(null);
      setDetailNote(null);
      await fetchNotes(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast("Failed to delete note", msg, "error");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="app-layout">
      {/* Navbar */}
      <Navbar
        auth={auth}
        effectiveTheme={effectiveTheme}
        onToggleTheme={toggleTheme}
        onOpenMemphisModal={() => setIsMemphisModalOpen(true)}
        onNewNoteClick={() => {
          setIsEditorOpen((prev) => !prev);
          setEditingNote(null);
        }}
        isEditorOpen={isEditorOpen}
        totalNotes={notes.length}
      />

      {/* Main Container */}
      <main className="main-content-container">
        {/* Status / Dev Mode Banner */}
        {isLocalDevMode && !isBannerDismissed && (
          <div className="alert-banner warning global-alert" role="status">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="stat-icon-wrap stat-amber" style={{ width: 36, height: 36 }}>
                <SparklesIcon size={16} />
              </div>
              <div className="alert-content">
                <h4>Local Preview Vault Active</h4>
                <p>
                  Canister wasm has not been deployed to <code>memphis.mercaturaforum.com</code> yet (
                  {canisterStatus === "not_deployed"
                    ? "run 'thebes-deploy deploy' to push to on-chain"
                    : statusMessage}
                  ). All features, notes, checklists, and colors are fully interactive and saved in your local browser vault.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void fetchNotes(true)}
                title="Check if backend canister is deployed"
              >
                <RefreshIcon size={13} />
                <span>Retry Canister</span>
              </button>
              <button
                type="button"
                className="icon-btn icon-btn-close"
                onClick={() => setIsBannerDismissed(true)}
                title="Dismiss banner"
                aria-label="Dismiss banner"
              >
                <CloseIcon size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Global Connection Error (if non-deployment error) */}
        {!isLocalDevMode && canisterStatus === "error" && statusMessage && (
          <div className="alert-banner error global-alert" role="alert">
            <WarningIcon size={18} />
            <div className="alert-content">
              <h4>Canister Sync Warning</h4>
              <p>{statusMessage}</p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void fetchNotes(true)}
            >
              <RefreshIcon size={14} />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Dashboard Stats Strip */}
        <StatsOverview
          totalNotes={notes.length}
          pinnedCount={pinnedCount}
          categoriesCount={categories.length - 1}
          selectedCategory={selectedCategory}
          onFilterPinned={() => setFilterPinnedOnly((prev) => !prev)}
          isFilterPinnedActive={filterPinnedOnly}
        />

        {/* Note Composer / Editor */}
        <NoteEditor
          editingNote={editingNote}
          onSave={handleSaveNote}
          onCancel={() => {
            setIsEditorOpen(false);
            setEditingNote(null);
          }}
          isLoading={actionLoading}
          isOpen={isEditorOpen}
          onToggleOpen={() => {
            setIsEditorOpen((prev) => !prev);
            setEditingNote(null);
          }}
          availableCategories={categories}
        />

        {/* Toolbar: Search, Categories, Sort, View */}
        <FilterToolbar
          search={search}
          onSearchChange={setSearch}
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          categoryCounts={categoryCounts}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          sortOption={sortOption}
          onSortOptionChange={setSortOption}
          totalFilteredNotes={filteredNotes.length}
        />

        {/* Notes Grid / List */}
        <section className="notes-display-section" aria-label="Notes collection">
          {loadingInitial ? (
            <SkeletonGrid count={6} />
          ) : filteredNotes.length === 0 ? (
            <EmptyState
              searchQuery={search}
              selectedCategory={selectedCategory}
              onClearFilters={() => {
                setSearch("");
                setSelectedCategory("All");
                setFilterPinnedOnly(false);
              }}
              onCreateNote={() => {
                setIsEditorOpen(true);
                setEditingNote(null);
              }}
              totalNotes={notes.length}
            />
          ) : (
            <div className={`notes-container view-${viewMode}`}>
              {filteredNotes.map((note) => (
                <NoteCard
                  key={note.id.toString()}
                  note={note}
                  viewMode={viewMode}
                  onEdit={handleStartEdit}
                  onDelete={setDeleteTarget}
                  onTogglePin={handleTogglePin}
                  onOpenDetail={setDetailNote}
                  isLoading={actionLoading}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Note Reader Detail Modal */}
      <NoteDetailModal
        note={detailNote}
        onClose={() => setDetailNote(null)}
        onEdit={handleStartEdit}
        onDelete={setDeleteTarget}
        onTogglePin={handleTogglePin}
      />

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={deleteTarget !== null}
        noteTitle={deleteTarget?.title || ""}
        isDeleting={actionLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Memphis Passkey Identity Modal */}
      <MemphisModal
        isOpen={isMemphisModalOpen}
        auth={auth}
        onClose={() => setIsMemphisModalOpen(false)}
      />

      {/* Floating Toast Alerts */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}