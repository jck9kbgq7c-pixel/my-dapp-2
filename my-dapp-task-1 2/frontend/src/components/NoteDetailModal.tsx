import { useEffect, useState } from "react";
import type { Note } from "../types";
import { formatFullDate } from "../utils/dateUtils";
import { getColorConfig, getNoteStats } from "../utils/noteUtils";
import {
  CloseIcon,
  CopyIcon,
  CheckIcon,
  EditIcon,
  TrashIcon,
  PinIcon,
  ClockIcon,
  TagIcon,
} from "./Icons";

interface NoteDetailModalProps {
  note: Note | null;
  onClose: () => void;
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
  onTogglePin: (id: bigint) => void;
}

export function NoteDetailModal({
  note,
  onClose,
  onEdit,
  onDelete,
  onTogglePin,
}: NoteDetailModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!note) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [note, onClose]);

  if (!note) return null;

  const colorConfig = getColorConfig(note.color);
  const stats = getNoteStats(note.title, note.body);

  const handleCopy = async () => {
    try {
      const fullText = `${note.title}\n\n${note.body}`;
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="note-detail-title"
    >
      <div className="modal-dialog note-reader-dialog">
        {/* Header */}
        <div className="reader-header">
          <div className="reader-header-left">
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

            {note.pinned && (
              <span className="pinned-badge">
                <PinIcon size={13} filled />
                Pinned
              </span>
            )}
          </div>

          <div className="reader-header-actions">
            <button
              type="button"
              className={`icon-btn ${note.pinned ? "active-pin" : ""}`}
              onClick={() => onTogglePin(note.id)}
              title={note.pinned ? "Unpin note" : "Pin note"}
              aria-label={note.pinned ? "Unpin note" : "Pin note"}
            >
              <PinIcon size={17} filled={note.pinned} />
            </button>

            <button
              type="button"
              className="icon-btn"
              onClick={handleCopy}
              title="Copy note text"
              aria-label="Copy note text"
            >
              {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
            </button>

            <button
              type="button"
              className="icon-btn"
              onClick={() => {
                onClose();
                onEdit(note);
              }}
              title="Edit note"
              aria-label="Edit note"
            >
              <EditIcon size={16} />
            </button>

            <button
              type="button"
              className="icon-btn icon-btn-danger"
              onClick={() => {
                onClose();
                onDelete(note);
              }}
              title="Delete note"
              aria-label="Delete note"
            >
              <TrashIcon size={16} />
            </button>

            <button
              type="button"
              className="icon-btn icon-btn-close"
              onClick={onClose}
              title="Close (Esc)"
              aria-label="Close modal"
            >
              <CloseIcon size={17} />
            </button>
          </div>
        </div>

        {/* Title */}
        <h2 id="note-detail-title" className="reader-title">
          {note.title}
        </h2>

        {/* Metadata Strip */}
        <div className="reader-meta-strip">
          <div className="meta-item">
            <ClockIcon size={14} />
            <span>Updated {formatFullDate(note.updatedAt)}</span>
          </div>
          <div className="meta-sep" />
          <div className="meta-item">
            <span>{stats.words} words</span>
          </div>
          <div className="meta-sep" />
          <div className="meta-item">
            <span>{stats.chars} characters</span>
          </div>
          <div className="meta-sep" />
          <div className="meta-item">
            <span>~{stats.readingTimeMin} min read</span>
          </div>
        </div>

        {/* Body */}
        <div className="reader-body">
          {note.body.split("\n\n").map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
