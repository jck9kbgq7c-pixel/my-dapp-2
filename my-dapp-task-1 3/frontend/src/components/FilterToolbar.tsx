import { useRef } from "react";
import type { ViewMode, SortOption } from "../types";
import {
  SearchIcon,
  CloseIcon,
  GridIcon,
  ListIcon,
  SortIcon,
} from "./Icons";

interface FilterToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  categoryCounts: Record<string, number>;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sortOption: SortOption;
  onSortOptionChange: (option: SortOption) => void;
  totalFilteredNotes: number;
}

export function FilterToolbar({
  search,
  onSearchChange,
  categories,
  selectedCategory,
  onSelectCategory,
  categoryCounts,
  viewMode,
  onViewModeChange,
  sortOption,
  onSortOptionChange,
  totalFilteredNotes,
}: FilterToolbarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="filter-toolbar">
      {/* Top row: Search + Sort + View Mode */}
      <div className="toolbar-top-row">
        {/* Search Box */}
        <div className="search-input-container">
          <SearchIcon size={17} className="search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            className="search-input"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search notes, tags, ideas..."
            aria-label="Search notes"
          />
          {search ? (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => {
                onSearchChange("");
                searchInputRef.current?.focus();
              }}
              aria-label="Clear search"
            >
              <CloseIcon size={13} />
            </button>
          ) : (
            <kbd className="search-kbd-hint">⌘K</kbd>
          )}
        </div>

        {/* Controls: Sort and View */}
        <div className="toolbar-controls">
          {/* Sort Dropdown */}
          <div className="sort-dropdown-wrap">
            <SortIcon size={15} className="sort-icon" />
            <select
              value={sortOption}
              onChange={(e) => onSortOptionChange(e.target.value as SortOption)}
              className="sort-select"
              aria-label="Sort notes"
            >
              <option value="updated_desc">Recently Updated</option>
              <option value="created_desc">Newest First</option>
              <option value="created_asc">Oldest First</option>
              <option value="title_asc">Title (A–Z)</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="view-mode-toggle" role="group" aria-label="View mode">
            <button
              type="button"
              className={`view-btn ${viewMode === "grid" ? "active" : ""}`}
              onClick={() => onViewModeChange("grid")}
              title="Grid view"
              aria-label="Grid view"
            >
              <GridIcon size={16} />
            </button>
            <button
              type="button"
              className={`view-btn ${viewMode === "list" ? "active" : ""}`}
              onClick={() => onViewModeChange("list")}
              title="Compact list view"
              aria-label="Compact list view"
            >
              <ListIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom row: Category Pills */}
      <div className="category-scroll-container">
        <div className="category-pills">
          {categories.map((cat) => {
            const count = categoryCounts[cat] || 0;
            const isSelected = selectedCategory === cat;

            return (
              <button
                key={cat}
                type="button"
                className={`category-chip ${isSelected ? "selected" : ""}`}
                onClick={() => onSelectCategory(cat)}
              >
                <span className="chip-label">{cat}</span>
                <span className="chip-badge">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Result summary */}
        <div className="result-counter-text">
          Showing {totalFilteredNotes} {totalFilteredNotes === 1 ? "result" : "results"}
        </div>
      </div>
    </div>
  );
}
