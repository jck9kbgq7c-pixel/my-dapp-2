import { useState, useEffect } from "react";
import type { MemphisAuth } from "../useMemphis";
import {
  KeyIcon,
  CloseIcon,
  ShieldCheckIcon,
  WarningIcon,
} from "./Icons";

interface MemphisModalProps {
  isOpen: boolean;
  auth: MemphisAuth;
  onClose: () => void;
}

export function MemphisModal({ isOpen, auth, onClose }: MemphisModalProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
      aria-labelledby="memphis-modal-title"
    >
      <div className="modal-dialog memphis-dialog">
        <div className="memphis-modal-header">
          <div className="memphis-title-wrap">
            <div className="memphis-icon-badge">
              <KeyIcon size={20} />
            </div>
            <div>
              <h3 id="memphis-modal-title">Thebes Memphis Identity</h3>
              <p className="memphis-subtitle">
                Passkey WebAuthn Authentication · Canister 921
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn icon-btn-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Content based on auth state */}
        <div className="memphis-modal-body">
          {auth.signedIn ? (
            <div className="memphis-signed-in">
              <div className="memphis-id-card">
                <div className="memphis-avatar">
                  <ShieldCheckIcon size={28} />
                </div>
                <div className="memphis-info">
                  <span className="memphis-label">Active Passkey Account</span>
                  <div className="memphis-name-row">
                    <span className="memphis-name">{auth.displayName}</span>
                    {auth.session?.display_tag && (
                      <span className="memphis-tag">
                        #{auth.session.display_tag}
                      </span>
                    )}
                  </div>
                  {auth.session?.anchor_id_hex && (
                    <span className="memphis-anchor">
                      Anchor: {auth.session.anchor_id_hex.slice(0, 10)}...
                      {auth.session.anchor_id_hex.slice(-8)}
                    </span>
                  )}
                </div>
              </div>

              <div className="memphis-security-tip">
                <ShieldCheckIcon size={16} />
                <span>
                  Your session is secured cryptographically with your device biometric passkey (Touch ID / Face ID / Security Key).
                </span>
              </div>

              <div className="dialog-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                >
                  Done
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    void auth.signOut();
                  }}
                  disabled={auth.busy}
                >
                  {auth.busy ? "Signing out..." : "Sign Out"}
                </button>
              </div>
            </div>
          ) : auth.pendingCreate ? (
            <div className="memphis-pending">
              <div className="alert-banner warning">
                <WarningIcon size={18} />
                <div>
                  <h4>Register new identity</h4>
                  <p>
                    No account exists for <strong>{auth.pendingCreate}</strong> yet.
                    Would you like to register this name and link a passkey?
                  </p>
                </div>
              </div>

              <div className="dialog-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={auth.cancelCreate}
                  disabled={auth.busy}
                >
                  Use Different Name
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void auth.confirmCreate()}
                  disabled={auth.busy}
                >
                  {auth.busy ? (
                    <>
                      <span className="btn-spinner" />
                      Creating Passkey...
                    </>
                  ) : (
                    <>
                      <KeyIcon size={16} />
                      Register with Passkey
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const n = name.trim();
                if (!n) return;
                const full = n.endsWith(".thebes") ? n : `${n}.thebes`;
                void auth.signIn(full).catch(() => {});
              }}
              className="memphis-form"
            >
              <label htmlFor="memphis-name-input" className="form-label">
                Memphis Name
              </label>

              <div className="memphis-input-wrap">
                <input
                  id="memphis-name-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="alice"
                  className="form-input memphis-input"
                  autoComplete="username webauthn"
                  disabled={auth.busy}
                />
                <span className="input-suffix">.thebes</span>
              </div>

              <p className="field-hint">
                Names are 3–32 lowercase alphanumeric characters. If you don't have an identity yet, enter your preferred name to register.
              </p>

              {auth.error && (
                <div className="alert-banner error">
                  <WarningIcon size={16} />
                  <span>{auth.error}</span>
                </div>
              )}

              <div className="memphis-dev-note">
                <p>
                  <strong>Note on Localhost:</strong> WebAuthn passkeys authenticate against <code>memphis.mercaturaforum.com</code> on deployed gateways. On localhost, note storage and backend functions run normally.
                </p>
              </div>

              <div className="dialog-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={auth.busy || !name.trim()}
                >
                  {auth.busy ? (
                    <>
                      <span className="btn-spinner" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <KeyIcon size={16} />
                      Continue with Passkey
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
