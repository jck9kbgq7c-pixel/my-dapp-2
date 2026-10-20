/**
 * Converts BigInt nanoseconds timestamp from Motoko into a JavaScript Date.
 */
export function timestampToDate(timestamp: bigint): Date {
  try {
    const millis = Number(timestamp / 1_000_000n);
    return new Date(millis);
  } catch {
    return new Date();
  }
}

/**
 * Returns human-friendly relative time ("Just now", "4m ago", "Yesterday").
 */
export function formatRelativeTime(timestamp: bigint): string {
  try {
    const date = timestampToDate(timestamp);
    const now = Date.now();
    const diffMs = now - date.getTime();

    if (diffMs < 0 || diffMs < 30_000) {
      return "Just now";
    }

    const diffMinutes = Math.floor(diffMs / 60_000);
    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) {
      return "Yesterday";
    }
    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return "";
  }
}

/**
 * Returns complete formatted date with time for tooltips and modal details.
 */
export function formatFullDate(timestamp: bigint): string {
  try {
    const date = timestampToDate(timestamp);
    return date.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
