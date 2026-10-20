import { useEffect, useRef } from "react";
import { WarningIcon, TrashIcon } from "./Icons";

interface DeleteModalProps {
  isOpen: boolean;
  noteTitle: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteModal({
  isOpen,
  noteTitle,
  isDeleting,
  onConfirm,
  onCancel,
}: DeleteModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isDeleting) {
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isDeleting, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) {
          onCancel();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      <div className="modal-dialog delete-dialog" ref={modalRef}>
        <div className="delete-badge">
          <WarningIcon size={24} />
        </div>

        <div className="dialog-content">
          <h3 id="delete-modal-title">Delete this note?</h3>
          <p className="dialog-desc">
            You are about to delete{" "}
            <strong>&ldquo;{noteTitle || "Untitled Note"}&rdquo;</strong>.
            This action will remove it permanently from the Thebes canister on-chain.
          </p>
        </div>

        <div className="dialog-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <span className="btn-spinner" />
                Deleting...
              </>
            ) : (
              <>
                <TrashIcon size={16} />
                Delete Permanently
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
