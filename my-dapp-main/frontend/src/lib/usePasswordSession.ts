/**
 * usePasswordSession — username + password sign-in, as a second way into an
 * account that was first created with a Memphis passkey.
 *
 * The password itself never leaves the browser. It is stretched with PBKDF2
 * (SHA-256, salted with the username) into a 32-byte key, and only that key
 * is sent to the contract, which stores a hash of it. On a correct login the
 * contract accepts a random 32-byte session token made here; that token is
 * then passed to every contract call exactly like a passkey token.
 */
import { useCallback, useState } from "react";
import { BACKEND_CANISTER_ID, loginWithPassword, logoutPassword } from "../thebes";

const STORAGE_KEY = `thebes-notes:password-session:${BACKEND_CANISTER_ID}`;
const SESSION_MS = 7 * 24 * 60 * 60 * 1000; // matches the contract's 7 days
const PBKDF2_ITERATIONS = 210_000;

export type PasswordSession = {
  username: string;
  token: string;
  expiresAt: number;
};

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/** Valid usernames: 3–32 chars of a–z, 0–9, dot, dash, underscore. */
export function isValidUsername(username: string): boolean {
  return /^[a-z0-9._-]{3,32}$/.test(normalizeUsername(username));
}

export const MIN_PASSWORD_LENGTH = 8;

/** Stretch a password into the 32-byte hex key the contract expects. */
export async function derivePasswordKey(username: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: enc.encode(`thebes-notes/v1|${normalizeUsername(username)}`),
      iterations: PBKDF2_ITERATIONS,
    },
    baseKey,
    256
  );
  return toHex(new Uint8Array(bits));
}

function newSessionToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

function readStored(): PasswordSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as PasswordSession;
    if (!s.token || !s.username || typeof s.expiresAt !== "number") return null;
    if (s.expiresAt <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

function writeStored(s: PasswordSession | null) {
  try {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage blocked: the session simply lasts until the tab closes
  }
}

/** Turn a contract error into a short sentence for the sign-in form. */
export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/too many failed attempts/i.test(msg)) return "Too many failed attempts. Try again in a few minutes.";
  if (/username already taken/i.test(msg)) return "That username is already taken.";
  if (/username must be/i.test(msg)) return "Usernames are 3–32 characters: a–z, 0–9, dot, dash or underscore.";
  if (/timed out|failed to fetch|networkerror/i.test(msg)) return "Couldn't reach the network. Check your connection and try again.";
  return msg;
}

export function usePasswordSession() {
  const [session, setSession] = useState<PasswordSession | null>(() => readStored());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const signIn = useCallback(async (username: string, password: string) => {
    setBusy(true);
    setError(undefined);
    try {
      const u = normalizeUsername(username);
      if (!isValidUsername(u)) throw new Error("Enter your username (3–32 characters).");
      if (!password) throw new Error("Enter your password.");

      const key = await derivePasswordKey(u, password);
      const token = newSessionToken();
      const ok = await loginWithPassword(token, u, key);
      if (!ok) throw new Error("Wrong username or password.");

      const s: PasswordSession = { username: u, token, expiresAt: Date.now() + SESSION_MS - 60_000 };
      writeStored(s);
      setSession(s);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const signOut = useCallback(() => {
    const current = readStored();
    writeStored(null);
    setSession(null);
    if (current) logoutPassword(current.token).catch(() => {});
  }, []);

  return { session, busy, error, signIn, signOut };
}
