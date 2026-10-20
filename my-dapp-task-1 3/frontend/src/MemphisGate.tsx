/**
 * MemphisGate — the sign-in strip for a Memphis-authenticated app.
 * Upgraded with modern design system styles, accessible inputs, and polished UI.
 */
import { useState } from "react";
import type { MemphisAuth } from "./useMemphis";
import { KeyIcon, ShieldCheckIcon, WarningIcon } from "./components/Icons";

export default function MemphisGate({ auth }: { auth: MemphisAuth }) {
  const [name, setName] = useState("");

  if (auth.signedIn) {
    return (
      <section className="memphis-id-card">
        <div className="memphis-avatar">
          <ShieldCheckIcon size={24} />
        </div>
        <div className="memphis-info">
          <span className="memphis-label">Identity · Memphis Passkey</span>
          <div className="memphis-name-row">
            <span className="memphis-name">{auth.displayName}</span>
            {auth.session?.display_tag && (
              <span className="memphis-tag">#{auth.session.display_tag}</span>
            )}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => void auth.signOut()}
          disabled={auth.busy}
        >
          {auth.busy ? "Signing out…" : "Sign out"}
        </button>
      </section>
    );
  }

  if (auth.pendingCreate) {
    return (
      <section className="alert-banner warning">
        <WarningIcon size={20} />
        <div className="alert-content" style={{ flex: 1 }}>
          <h4>Register Passkey Identity</h4>
          <p>
            No identity exists for <strong>{auth.pendingCreate}</strong> yet. Register with your device passkey to claim this name on-chain.
          </p>
          <div className="dialog-actions" style={{ justifyContent: "flex-start", marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void auth.confirmCreate()}
              disabled={auth.busy}
            >
              {auth.busy ? "Waiting for passkey…" : "Create with Passkey"}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={auth.cancelCreate}
              disabled={auth.busy}
            >
              Use different name
            </button>
          </div>
          {auth.error && <p className="composer-error-banner" style={{ marginTop: 8 }}>{auth.error}</p>}
        </div>
      </section>
    );
  }

  return (
    <section className="memphis-id-card" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <KeyIcon size={18} className="text-primary" />
        <span className="memphis-name" style={{ fontSize: 14 }}>Sign in with Memphis Passkey</span>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (!n) return;
          const full = n.endsWith(".thebes") ? n : `${n}.thebes`;
          void auth.signIn(full).catch(() => {});
        }}
        style={{ display: "flex", gap: 8 }}
      >
        <div className="memphis-input-wrap" style={{ flex: 1 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="yourname"
            className="form-input memphis-input"
            aria-label="Memphis name"
            autoComplete="username webauthn"
            disabled={auth.busy}
          />
          <span className="input-suffix">.thebes</span>
        </div>
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={auth.busy || !name.trim()}
        >
          {auth.busy ? "Checking…" : "Sign In"}
        </button>
      </form>
      {auth.error && <div className="alert-banner error">{auth.error}</div>}
    </section>
  );
}
