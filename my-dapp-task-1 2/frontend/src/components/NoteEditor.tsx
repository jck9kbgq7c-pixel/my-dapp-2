import { useState, useEffect, useRef } from "react";
import type { Note } from "../types";
import {
  NOTE_COLOR_CONFIGS,
  DEFAULT_CATEGORIES,
  getNoteStats,
} from "../utils/noteUtils";
import {
  CheckIcon,
  CloseIcon,
  SparklesIcon,
  EditIcon,
  BoldIcon,
  ChecklistIcon,
  CodeIcon,
} from "./Icons";

interface NoteEditorProps {
  editingNote: Note | null;
  onSave: (data: {
    title: string;
    body: string;
    category: string;
    color: string;
  }) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
  availableCategories: string[];
}

export function NoteEditor({
  editingNote,
  onSave,
  onCancel,
  isLoading,
  isOpen,
  onToggleOpen,
  availableCategories,
}: NoteEditorProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("Personal");
  const [color, setColor] = useState(NOTE_COLOR_CONFIGS[0].hex);
  const [customCategory, setCustomCategory] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [validationError, setValidationError] = useState("");

  const titleInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync state when editingNote changes
  useEffect(() => {
    if (editingNote) {
      setTitle(editingNote.title);
      setBody(editingNote.body);
      setCategory(editingNote.category || "Personal");
      setColor(editingNote.color || NOTE_COLOR_CONFIGS[0].hex);
      setValidationError("");
    } else {
      setTitle("");
      setBody("");
      setCategory("Personal");
      setColor(NOTE_COLOR_CONFIGS[0].hex);
      setCustomCategory("");
      setIsAddingCategory(false);
      setValidationError("");
    }
  }, [editingNote]);

  // Focus title input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const stats = getNoteStats(title, body);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const cleanTitle = title.trim();
    const cleanBody = body.trim();

    if (!cleanTitle && !cleanBody) {
      setValidationError("Please enter at least a title or note body.");
      titleInputRef.current?.focus();
      return;
    }

    const finalCategory = isAddingCategory && customCategory.trim()
      ? customCategory.trim()
      : category || "Personal";

    setValidationError("");

    try {
      await onSave({
        title: cleanTitle || "Untitled Note",
        body: cleanBody,
        category: finalCategory,
        color,
      });

      // Reset
      setTitle("");
      setBody("");
      setIsAddingCategory(false);
      setCustomCategory("");
    } catch {
      // Handled in parent
    }
  };

  // Keyboard shortcut: Cmd/Ctrl + Enter to save
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSubmit();
    }
    if (e.key === "Escape" && editingNote) {
      onCancel();
    }
  };

  // Insert markdown helpers into textarea
  const insertText = (prefix: string, suffix: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = body.substring(start, end);
    const replacement = `${prefix}${selected || "text"}${suffix}`;

    const newBody = body.substring(0, start) + replacement + body.substring(end);
    setBody(newBody);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + (selected ? selected.length : 4)
      );
    }, 10);
  };

  const categoriesList = Array.from(
    new Set([
      ...DEFAULT_CATEGORIES,
      ...availableCategories.filter((c) => c !== "All"),
    ])
  );

  if (!isOpen && !editingNote) {
    return (
      <div className="composer-collapsed" onClick={onToggleOpen}>
        <div className="composer-trigger-inner">
          <div className="composer-trigger-icon">
            <SparklesIcon size={18} />
          </div>
          <span className="composer-trigger-text">
            Take a note... or jot down your decentralized thoughts
          </span>
          <kbd className="composer-shortcut">⌘N</kbd>
        </div>
      </div>
    );
  }

  return (
    <section className="note-composer-card" onKeyDown={handleKeyDown}>
      <form onSubmit={handleSubmit} className="composer-form">
        {/* Top bar */}
        <div className="composer-header">
          <div className="composer-title-badge">
            {editingNote ? (
              <>
                <EditIcon size={14} />
                <span>EDITING NOTE</span>
              </>
            ) : (
              <>
                <SparklesIcon size={14} />
                <span>NEW ON-CHAIN NOTE</span>
              </>
            )}
          </div>

          <div className="composer-header-actions">
            <button
              type="button"
              className="icon-btn icon-btn-close"
              onClick={() => {
                if (editingNote) onCancel();
                else onToggleOpen();
              }}
              title="Close editor (Esc)"
              aria-label="Close editor"
            >
              <CloseIcon size={16} />
            </button>
          </div>
        </div>

        {validationError && (
          <div className="composer-error-banner" role="alert">
            <span>{validationError}</span>
          </div>
        )}

        {/* Title input */}
        <div className="composer-field">
          <input
            ref={titleInputRef}
            type="text"
            className="composer-title-input"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (validationError) setValidationError("");
            }}
            placeholder="Note Title"
            aria-label="Note Title"
            maxLength={120}
          />
        </div>

        {/* Markdown toolbar helpers */}
        <div className="composer-toolbar-helpers">
          <button
            type="button"
            className="format-btn"
            onClick={() => insertText("**", "**")}
            title="Bold text (**text**)"
          >
            <BoldIcon size={13} />
            <span>Bold</span>
          </button>
          <button
            type="button"
            className="format-btn"
            onClick={() => insertText("- [ ] ")}
            title="Checklist item (- [ ])"
          >
            <ChecklistIcon size={13} />
            <span>Checklist</span>
          </button>
          <button
            type="button"
            className="format-btn"
            onClick={() => insertText("- ")}
            title="Bullet list (- )"
          >
            <span>• Bullet</span>
          </button>
          <button
            type="button"
            className="format-btn"
            onClick={() => insertText("```\n", "\n```")}
            title="Code block"
          >
            <CodeIcon size={13} />
            <span>Code</span>
          </button>
        </div>

        {/* Body Textarea */}
        <div className="composer-field">
          <textarea
            ref={textareaRef}
            className="composer-body-textarea"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              if (validationError) setValidationError("");
            }}
            placeholder="Write your note body, checklist, meeting notes, code snippet..."
            aria-label="Note Body"
            rows={5}
          />
        </div>

        {/* Controls Bar: Category & Color & Action */}
        <div className="composer-options-bar">
          {/* Category selection */}
          <div className="category-select-group">
            <span className="options-label">Category</span>
            {isAddingCategory ? (
              <div className="custom-category-input-wrap">
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="New category..."
                  className="custom-cat-input"
                  autoFocus
                />
                <button
                  type="button"
                  className="icon-btn-sm"
                  onClick={() => setIsAddingCategory(false)}
                  title="Cancel custom category"
                >
                  <CloseIcon size={12} />
                </button>
              </div>
            ) : (
              <div className="category-select-wrapper">
                <select
                  value={category}
                  onChange={(e) => {
                    if (e.target.value === "__add_new__") {
                      setIsAddingCategory(true);
                      setCustomCategory("");
                    } else {
                      setCategory(e.target.value);
                    }
                  }}
                  className="composer-select"
                >
                  {categoriesList.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="__add_new__">+ Custom Category...</option>
                </select>
              </div>
            )}
          </div>

          {/* Color Palette */}
          <div className="color-palette-group">
            <span className="options-label">Card Tint</span>
            <div className="palette-swatches" role="radiogroup" aria-label="Card color tint">
              {NOTE_COLOR_CONFIGS.map((cfg) => {
                const isSelected = color.toLowerCase() === cfg.hex.toLowerCase();
                return (
                  <button
                    key={cfg.hex}
                    type="button"
                    className={`swatch-btn ${isSelected ? "selected" : ""}`}
                    style={{ backgroundColor: cfg.hex }}
                    onClick={() => setColor(cfg.hex)}
                    title={cfg.name}
                    aria-label={`Select ${cfg.name} color`}
                    role="radio"
                    aria-checked={isSelected}
                  >
                    {isSelected && <CheckIcon size={12} className="swatch-check" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="composer-footer">
          <div className="composer-stats-indicator">
            <span>{stats.words} words</span>
            <span className="stat-dot">·</span>
            <span>{stats.chars} chars</span>
            <span className="stat-dot">·</span>
            <span className="shortcut-hint">Press ⌘↵ to save</span>
          </div>

          <div className="composer-buttons">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                if (editingNote) onCancel();
                else onToggleOpen();
              }}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="btn-spinner" />
                  Saving to Canister...
                </>
              ) : (
                <>
                  <SparklesIcon size={15} />
                  <span>{editingNote ? "Save Changes" : "Create Note"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
