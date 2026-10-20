import { useEffect } from "react";
import type { ToastMessage } from "../types";
import { CheckIcon, CloseIcon, WarningIcon, SparklesIcon } from "./Icons";

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4500);

    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const renderIcon = () => {
    switch (toast.type) {
      case "success":
        return <CheckIcon size={18} />;
      case "error":
      case "warning":
        return <WarningIcon size={18} />;
      case "info":
      default:
        return <SparklesIcon size={18} />;
    }
  };

  return (
    <div className={`toast-item toast-${toast.type}`} role="alert">
      <div className="toast-icon-wrap">{renderIcon()}</div>
      <div className="toast-content">
        <h4 className="toast-title">{toast.title}</h4>
        {toast.message && <p className="toast-desc">{toast.message}</p>}
      </div>
      <button
        type="button"
        className="toast-close"
        onClick={() => onDismiss(toast.id)}
        aria-label="Close notification"
      >
        <CloseIcon size={14} />
      </button>
    </div>
  );
}
