# my-dapp

A smart-contract project on the **Thebes** substrate, scaffolded by
`thebes-deploy new`.

## Deploy

```bash
thebes-deploy identity new default   # once per machine
thebes-deploy setup                  # checks moc / mops / cargo / npm as needed
thebes-deploy deploy                 # build + install + upload + verify
```

`thebes.toml` is the single source of truth: which network, which
canisters, how they build, who signs. The canister ids in it were
pre-allocated when this project was created, so the frontend already
knows how to reach its backend.

## Talk to the backend from the CLI

```bash
thebes-deploy query backend greet --arg '("Thebes")'
thebes-deploy call  backend increment
thebes-deploy query backend get_count
```

Arguments use Candid's textual form, same as dfx.

## Where the app is served

After `deploy`, a frontend canister's bundle is served through the
boundary at:

```
<gateway>/_/raw/<frontend-cid>/index.html
```

The exact URL (with your cid filled in) is printed at the end of every
`thebes-deploy deploy` run.

## Identity (Memphis) — only if you scaffolded with it

If this project has `frontend/public/passkey.js` (React) or
`frontend/dist/passkey.js` (no-framework), Memphis passkey sign-in is
wired up. Memphis is Thebes' identity layer — the substrate's Internet
Identity equivalent — living at canister **921**.

- A new name **registers** a passkey; an existing name **signs in**.
- The session (anchor id + token + display tag) persists in
  localStorage, so a refresh stays signed in.
- React: the `useMemphis()` hook and `<MemphisGate>` component.
  No-framework: `memphis.js` wires the buttons.

**Passkeys only work when served from the gateway.** `passkey.js` pins
the WebAuthn relying-party id to `memphis.mercaturaforum.com`, so
sign-in works at `<gateway>/_/raw/<cid>/index.html` but **fails on
localhost** (`npm run dev` can still exercise the backend). Details and
how to retarget: `passkey.PROVENANCE.md`.

The starter does **not** gate the counter on sign-in — it shows the
mechanism, not a permission model. To make it real, gate on
`auth.signedIn` in the UI **and** verify the session token in your
backend; a client-side check alone is not authorization.

## Troubleshooting

**Rust build fails with `can't find crate for 'core'` / "target may not be
installed"** — the Rust canister compiles to `wasm32-unknown-unknown`, and
the *active* toolchain lacks that target. Note the active toolchain can be
pinned by a `rust-toolchain.toml` in a parent directory (so the default
toolchain having the target is not enough). `thebes-deploy setup` reports
this. Fix, run from inside this project:

```bash
rustup target add wasm32-unknown-unknown
```

**Rust build fails mentioning some *other* workspace's members** — the
generated `backend/Cargo.toml` declares an empty `[workspace]` precisely
to stop cargo walking up into an enclosing workspace. Don't remove it.

**Motoko build fails with `moc: could not find a Qt installation`** —
your PATH's `moc` is Qt's meta-object compiler, not the Motoko
compiler (they share a name; Qt's usually sits at `/usr/bin/moc`).
`thebes-deploy setup` reports this as `wrong tool`. Fix by putting the
real compiler first on PATH — dfx users:

```bash
export PATH="$HOME/.cache/dfinity/versions/<version>/:$PATH"
```

or let mops manage it: `mops toolchain init && mops toolchain use moc`.

**`moc version does not meet the requirements of core@…`** — a mops
warning, not an error; this starter imports nothing from `mo:core`, so
the build proceeds. Align the `mops.toml` core pin with your moc
version once you start importing core modules.

**`vite build` warns `<script src="./passkey.js"> … can't be bundled
without type="module"`** (Memphis projects) — expected and harmless.
`passkey.js` is a classic script served from `public/`, so Vite copies it
verbatim. The path must stay relative because the app is served under
`/_/raw/<cid>/`; the absolute path that would silence the warning would
404 against the gateway root.

**Signed in as someone else / state from another project?** Every app on
the gateway is served from the same origin, and `localStorage` is
per-origin. This project scopes its keys by backend canister id
(`MEMPHIS_SESSION_SCOPE` in `index.html`, `thebes-demo-sender:<cid>`), so
projects no longer share a session. Note the on-chain *per-app principal*
is still derived from the origin, so two apps on the same gateway host
resolve to the same Memphis identity — that needs per-app domains, not a
client change.

**Motoko backend: state resets on every redeploy.** `deploy` upgrades in
place, but Motoko keeps state in main memory, which this substrate rebuilds —
so `var` values return to their initial state each time you ship a code
change. A Rust backend's stable structures survive. If your project needs to
keep data across code changes, use a Rust backend for now. Root cause and the
planned fix: `docs/MOTOKO-PERSISTENCE.md` in the Thebes repo.

## Layout

```
thebes.toml        deploy manifest — the single source of truth
backend/           the backend canister source
frontend/          the frontend (when scaffolded with one)
  asset_canister.wasm   the asset-serving canister installed for the frontend
```

## Username & password login

Besides the Memphis passkey, an account can also be opened with a username
and password. It is a second way into the SAME account, not a separate one:

1. Sign in with your passkey.
2. Click your name (top right) → **Username & password** → choose a username
   and a password (8+ characters) → **Save**.
3. From then on, the sign-in screen's **Username & password** tab opens the
   same notes, points and history.

How it works:

- The browser stretches the password with PBKDF2-SHA256 (210,000 rounds,
  salted with the username) and sends only the resulting key. The contract
  stores a SHA-256 hash of that key — never the password.
- A successful login registers a random 32-byte session token (stored as a
  hash) that is valid for 7 days and is passed to every call like a passkey
  token. `requireCaller` accepts either kind.
- Setting, changing or removing the password requires a passkey session.
  Changing it signs out every password session.
- Five wrong passwords lock that username for 5 minutes.
- Backend methods: `setPassword`, `removePassword`, `loginWithPassword`,
  `logoutPassword`, `getUsername` (code in `backend/Backend.mo`,
  hashing in `backend/Sha256.mo`, browser side in
  `frontend/src/lib/usePasswordSession.ts`).

Note: Motoko state resets on every redeploy (see above), so usernames and
passwords have to be set again after a redeploy, just like notes.

## Hosting the frontend on Vercel

The app also runs from Vercel (or any other host), not only the Thebes gateway.

- `vercel.json` forwards `/api/...` to `https://memphis.mercaturaforum.com/api/...`,
  where the chain's API lives. There is one in the project root and one in
  `frontend/`; whichever folder is Vercel's Root Directory picks it up.
- A passkey token is valid only for the web address it was made on. The frontend
  sends its address with every call, and the contract accepts only addresses in
  `ALLOWED_ORIGINS` (top of `backend/Backend.mo`). **Add your Vercel production
  domain there and run `thebes-deploy deploy`.** Preview links change on every
  Vercel deploy, so use the production domain.
- Accounts are the same everywhere: signing in on the gateway or on Vercel gives
  the same notes, points and history.
