import { SunIcon, MoonIcon, KeyIcon, PlusIcon, SparklesIcon, ShieldCheckIcon } from "./Icons";
import type { MemphisAuth } from "../useMemphis";
import { BACKEND_CANISTER_ID } from "../thebes";

interface NavbarProps {
  auth: MemphisAuth;
  effectiveTheme: "light" | "dark";
  onToggleTheme: () => void;
  onOpenMemphisModal: () => void;
  onNewNoteClick: () => void;
  isEditorOpen: boolean;
  totalNotes: number;
}

export function Navbar({
  auth,
  effectiveTheme,
  onToggleTheme,
  onOpenMemphisModal,
  onNewNoteClick,
  isEditorOpen,
  totalNotes,
}: NavbarProps) {
  const canisterShort = `${String(BACKEND_CANISTER_ID).slice(0, 6)}...${String(BACKEND_CANISTER_ID).slice(-4)}`;

  return (
    <header className="app-navbar">
      <div className="navbar-container">
        {/* Brand */}
        <div className="brand-group">
          <div className="brand-logo-wrap">
            <span className="brand-glyph">☥</span>
            <div className="brand-glow" />
          </div>
          <div className="brand-meta">
            <div className="brand-title-row">
              <span className="brand-name">THEBES NOTES</span>
              <span className="brand-badge">DAPP</span>
            </div>
            <div className="network-status" title={`Backend Canister ID: ${BACKEND_CANISTER_ID}`}>
              <span className="status-dot pulse" />
              <span className="status-text">Canister #{canisterShort}</span>
            </div>
          </div>
        </div>

        {/* Center / Stats Pill */}
        <div className="navbar-center-pill">
          <SparklesIcon size={14} className="accent-icon" />
          <span>Decentralized Notes</span>
          <span className="nav-stat-divider">·</span>
          <span className="nav-notes-count">
            {totalNotes} {totalNotes === 1 ? "note" : "notes"} stored
          </span>
        </div>

        {/* Right Actions */}
        <div className="navbar-actions">
          {/* Memphis Passkey Identity Button */}
          <button
            type="button"
            className={`memphis-auth-btn ${auth.signedIn ? "signed-in" : ""}`}
            onClick={onOpenMemphisModal}
            title={auth.signedIn ? `Signed in as ${auth.displayName}` : "Connect Memphis Passkey"}
          >
            {auth.signedIn ? (
              <>
                <ShieldCheckIcon size={16} className="text-emerald" />
                <span className="auth-display-name">{auth.displayName}</span>
                {auth.session?.display_tag && (
                  <span className="auth-tag">#{auth.session.display_tag}</span>
                )}
              </>
            ) : (
              <>
                <KeyIcon size={15} />
                <span className="auth-label">Passkey Identity</span>
              </>
            )}
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={onToggleTheme}
            title={`Switch to ${effectiveTheme === "dark" ? "light" : "dark"} mode`}
            aria-label="Toggle color theme"
          >
            {effectiveTheme === "dark" ? (
              <SunIcon size={18} className="theme-icon sun" />
            ) : (
              <MoonIcon size={18} className="theme-icon moon" />
            )}
          </button>

          {/* New Note CTA */}
          <button
            type="button"
            className="btn btn-primary new-note-btn"
            onClick={onNewNoteClick}
          >
            <PlusIcon size={16} />
            <span>{isEditorOpen ? "Writing Note" : "New Note"}</span>
            <kbd className="kbd-shortcut">⌘N</kbd>
          </button>
        </div>
      </div>
    </header>
  );
}
