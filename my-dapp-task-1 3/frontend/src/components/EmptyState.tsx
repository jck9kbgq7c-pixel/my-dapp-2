import { SparklesIcon, SearchIcon, PlusIcon, CloseIcon } from "./Icons";

interface EmptyStateProps {
  searchQuery: string;
  selectedCategory: string;
  onClearFilters: () => void;
  onCreateNote: () => void;
  totalNotes: number;
}

export function EmptyState({
  searchQuery,
  selectedCategory,
  onClearFilters,
  onCreateNote,
  totalNotes,
}: EmptyStateProps) {
  const isSearchOrFilterActive = Boolean(searchQuery || selectedCategory !== "All");

  if (isSearchOrFilterActive) {
    return (
      <div className="empty-state-card" role="status">
        <div className="empty-state-icon-wrap empty-icon-search">
          <SearchIcon size={28} />
        </div>
        <h3 className="empty-state-title">No matching notes found</h3>
        <p className="empty-state-desc">
          {searchQuery && selectedCategory !== "All" ? (
            <>
              No notes matched &ldquo;<strong>{searchQuery}</strong>&rdquo; in the{" "}
              <strong>{selectedCategory}</strong> category.
            </>
          ) : searchQuery ? (
            <>
              We couldn&apos;t find any notes matching &ldquo;
              <strong>{searchQuery}</strong>&rdquo;. Try another query or check for typos.
            </>
          ) : (
            <>
              There are no notes in the <strong>{selectedCategory}</strong> category yet.
            </>
          )}
        </p>

        <div className="empty-state-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClearFilters}
          >
            <CloseIcon size={14} />
            <span>Clear Filters</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onCreateNote}
          >
            <PlusIcon size={15} />
            <span>Create New Note</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="empty-state-card" role="status">
      <div className="empty-state-icon-wrap empty-icon-sparkle">
        <SparklesIcon size={32} />
      </div>
      <h3 className="empty-state-title">
        {totalNotes === 0 ? "Your decentralized vault is empty" : "No notes to show"}
      </h3>
      <p className="empty-state-desc">
        Notes created here are cryptographically stored on the Thebes blockchain substrate.
        Jot down ideas, checklists, code snippets, or personal thoughts.
      </p>

      <div className="empty-state-actions">
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={onCreateNote}
        >
          <PlusIcon size={17} />
          <span>Write Your First Note</span>
        </button>
      </div>
    </div>
  );
}
