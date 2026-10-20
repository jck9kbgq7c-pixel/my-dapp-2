import { PinIcon, TagIcon, SparklesIcon } from "./Icons";

interface StatsOverviewProps {
  totalNotes: number;
  pinnedCount: number;
  categoriesCount: number;
  selectedCategory: string;
  onFilterPinned: () => void;
  isFilterPinnedActive: boolean;
}

export function StatsOverview({
  totalNotes,
  pinnedCount,
  categoriesCount,
  selectedCategory,
  onFilterPinned,
  isFilterPinnedActive,
}: StatsOverviewProps) {
  return (
    <div className="stats-overview-grid">
      {/* Total Notes Card */}
      <div className="stat-card">
        <div className="stat-card-inner">
          <div className="stat-icon-wrap stat-purple">
            <SparklesIcon size={18} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Notes</span>
            <div className="stat-value-row">
              <span className="stat-value">{totalNotes}</span>
              <span className="stat-pill-hint">On-chain</span>
            </div>
          </div>
        </div>
        <div className="stat-subtext">
          {totalNotes === 0 ? "No notes recorded yet" : `${totalNotes} stored in canister`}
        </div>
      </div>

      {/* Pinned Notes Card */}
      <div
        className={`stat-card stat-interactive ${isFilterPinnedActive ? "stat-active-filter" : ""}`}
        onClick={onFilterPinned}
        role="button"
        tabIndex={0}
        title="Click to toggle pinned notes filter"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onFilterPinned();
          }
        }}
      >
        <div className="stat-card-inner">
          <div className="stat-icon-wrap stat-amber">
            <PinIcon size={18} filled />
          </div>
          <div className="stat-content">
            <span className="stat-label">Starred & Pinned</span>
            <div className="stat-value-row">
              <span className="stat-value">{pinnedCount}</span>
              {pinnedCount > 0 && (
                <span className="stat-pill-action">
                  {isFilterPinnedActive ? "Showing only pinned" : "Filter"}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="stat-subtext">
          {pinnedCount === 0
            ? "Star notes to keep them on top"
            : `${pinnedCount} prioritized items`}
        </div>
      </div>

      {/* Categories Card */}
      <div className="stat-card">
        <div className="stat-card-inner">
          <div className="stat-icon-wrap stat-emerald">
            <TagIcon size={18} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Categories</span>
            <div className="stat-value-row">
              <span className="stat-value">{categoriesCount}</span>
              <span className="stat-pill-hint">Active: {selectedCategory}</span>
            </div>
          </div>
        </div>
        <div className="stat-subtext">Organized across workspaces</div>
      </div>
    </div>
  );
}
