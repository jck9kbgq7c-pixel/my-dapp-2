export function SkeletonCard() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="skeleton-top">
        <div className="skeleton-pill shimmer" />
        <div className="skeleton-circle shimmer" />
      </div>
      <div className="skeleton-title shimmer" />
      <div className="skeleton-body shimmer" />
      <div className="skeleton-body-short shimmer" />
      <div className="skeleton-bottom">
        <div className="skeleton-meta shimmer" />
        <div className="skeleton-actions">
          <div className="skeleton-btn shimmer" />
          <div className="skeleton-btn shimmer" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
