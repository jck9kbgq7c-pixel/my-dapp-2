import { useState } from "react";
import type { Note, ViewMode } from "../types";
import { formatRelativeTime, formatFullDate } from "../utils/dateUtils";
import { getColorConfig } from "../utils/noteUtils";
import {
  PinIcon,
  TrashIcon,
  EditIcon,
  CopyIcon,
  CheckIcon,
  ExpandIcon,
  TagIcon,
} from "./Icons";

interface NoteCardProps {
  note: Note;
  viewMode: ViewMode;
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
  onTogglePin: (id: bigint) => void;
  onOpenDetail: (note: Note) => void;
  isLoading: boolean;
}

export function NoteCard({
  note,
  viewMode,
  onEdit,
  onDelete,
  onTogglePin,
  onOpenDetail,
  isLoading,
}: NoteCardProps) {
  const [copied, setCopied] = useState(false);
  const colorConfig = getColorConfig(note.color);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const fullText = `${note.title}\n\n${note.body}`;
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  // Render body preview with checklist support
  const renderBodyPreview = (text: string) => {
    if (!text) return null;

    const lines = text.split("\n");
    const previewLines = lines.slice(0, 5);

    return (
      <div className="card-body-preview">
        {previewLines.map((line, idx) => {
          if (line.startsWith("- [ ] ")) {
            return (
              <div key={idx} className="checklist-preview-item">
                <span className="checklist-box uncheck" />
                <span className="checklist-text">{line.replace("- [ ] ", "")}</span>
              </div>
            );
          }
          if (line.startsWith("- [x] ") || line.startsWith("- [X] ")) {
            return (
              <div key={idx} className="checklist-preview-item done">
                <span className="checklist-box checked">✓</span>
                <span className="checklist-text">{line.replace(/- \[[xX]\] /, "")}</span>
              </div>
            );
          }
          return (
            <p key={idx} className="card-body-line">
              {line}
            </p>
          );
        })}
        {lines.length > 5 && (
          <span className="card-more-lines">+ {lines.length - 5} more lines</span>
        )}
      </div>
    );
  };

  if (viewMode === "list") {
    return (
      <article
        className={`note-row-item ${note.pinned ? "is-pinned" : ""}`}
        onClick={() => onOpenDetail(note)}
        tabIndex={0}
        role="button"
        onKeyDown={(e) => {
          if (e.key === "Enter") onOpenDetail(note);
        }}
      >
        <div className="row-left">
          {/* Pin toggle */}
          <button
            type="button"
            className={`row-pin-btn ${note.pinned ? "pinned" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(note.id);
            }}
            disabled={isLoading}
            title={note.pinned ? "Unpin note" : "Pin note to top"}
            aria-label={note.pinned ? "Unpin note" : "Pin note"}
          >
            <PinIcon size={16} filled={note.pinned} />
          </button>

          {/* Color accent strip */}
          <span
            className="row-accent-indicator"
            style={{ backgroundColor: colorConfig.accent }}
          />

          <div className="row-main">
            <div className="row-title-line">
              <h3 className="row-title">{note.title}</h3>
              <span
                className="category-pill-sm"
                style={{
                  borderColor: colorConfig.borderLight,
                  color: colorConfig.accent,
                }}
              >
                {note.category || "General"}
              </span>
            </div>
            <p className="row-snippet">
              {note.body.replace(/\n+/g, " ").slice(0, 110)}
              {note.body.length > 110 ? "..." : ""}
            </p>
          </div>
        </div>

        <div className="row-right">
          <span className="row-date" title={formatFullDate(note.updatedAt)}>
            {formatRelativeTime(note.updatedAt)}
          </span>

          <div className="row-actions" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="action-icon-btn"
              onClick={handleCopy}
              title="Copy text"
              aria-label="Copy note text"
            >
              {copied ? <CheckIcon size={14} className="text-emerald" /> : <CopyIcon size={14} />}
            </button>
            <button
              type="button"
              className="action-icon-btn"
              onClick={() => onEdit(note)}
              title="Edit note"
              aria-label="Edit note"
            >
              <EditIcon size={14} />
            </button>
            <button
              type="button"
              className="action-icon-btn action-icon-danger"
              onClick={() => onDelete(note)}
              title="Delete note"
              aria-label="Delete note"
            >
              <TrashIcon size={14} />
            </button>
          </div>
        </div>
      </article>
    );
  }

  // Grid View Card
  return (
    <article
      className={`note-card ${note.pinned ? "is-pinned" : ""}`}
      style={
        {
          "--card-tint-light": colorConfig.bgLight,
          "--card-tint-dark": colorConfig.bgDark,
          "--card-accent": colorConfig.accent,
          "--card-border-light": colorConfig.borderLight,
          "--card-border-dark": colorConfig.borderDark,
        } as React.CSSProperties
      }
      onClick={() => onOpenDetail(note)}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpenDetail(note);
      }}
    >
      {/* Top Bar */}
      <div className="card-top-bar" onClick={(e) => e.stopPropagation()}>
        <span
          className="category-pill"
          style={{
            borderColor: colorConfig.borderLight,
            color: colorConfig.accent,
          }}
        >
          <TagIcon size={12} />
          {note.category || "General"}
        </span>

        <button
          type="button"
          className={`pin-btn ${note.pinned ? "pinned" : ""}`}
          onClick={() => onTogglePin(note.id)}
          disabled={isLoading}
          title={note.pinned ? "Unpin note" : "Pin note to top"}
          aria-label={note.pinned ? "Unpin note" : "Pin note"}
        >
          <PinIcon size={16} filled={note.pinned} />
        </button>
      </div>

      {/* Card Content */}
      <div className="card-content">
        <h3 className="card-title">{note.title}</h3>
        {renderBodyPreview(note.body)}
      </div>

      {/* Card Footer */}
      <div className="card-footer" onClick={(e) => e.stopPropagation()}>
        <div className="card-meta">
          <span className="card-timestamp" title={formatFullDate(note.updatedAt)}>
            {note.updatedAt !== note.createdAt ? "Edited " : ""}
            {formatRelativeTime(note.updatedAt)}
          </span>
        </div>

        <div className="card-actions">
          <button
            type="button"
            className="action-icon-btn"
            onClick={handleCopy}
            title="Copy note text"
            aria-label="Copy note text"
          >
            {copied ? (
              <CheckIcon size={14} className="text-emerald" />
            ) : (
              <CopyIcon size={14} />
            )}
          </button>

          <button
            type="button"
            className="action-icon-btn"
            onClick={() => onOpenDetail(note)}
            title="Expand note"
            aria-label="Expand note view"
          >
            <ExpandIcon size={14} />
          </button>

          <button
            type="button"
            className="action-icon-btn"
            onClick={() => onEdit(note)}
            title="Edit note"
            aria-label="Edit note"
          >
            <EditIcon size={14} />
          </button>

          <button
            type="button"
            className="action-icon-btn action-icon-danger"
            onClick={() => onDelete(note)}
            title="Delete note"
            aria-label="Delete note"
          >
            <TrashIcon size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}
