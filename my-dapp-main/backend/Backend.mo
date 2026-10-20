import Array "mo:core/Array";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Blob "mo:core/Blob";
import Runtime "mo:core/Runtime";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Nat8 "mo:core/Nat8";
import MemphisAuth "mo:thebes-lib/MemphisAuth";
import Sha256 "Sha256";

persistent actor Notes {

  public type Note = {
    id : Nat;
    title : Text;
    body : Text;
    category : Text;
    pinned : Bool;
    isShared : Bool;
    color : Text;
    createdAt : Int;
    updatedAt : Int;
    owner : Principal;
  };

  var notes : [Note] = [];
  var nextId : Nat = 0;

  func appendOne<T>(arr : [T], item : T) : [T] {
    Array.tabulate<T>(
      arr.size() + 1,
      func(i : Nat) : T {
        if (i < arr.size()) {
          arr[i]
        } else {
          item
        };
      },
    );
  };

  // ── Points ──────────────────────────────────────────────
  // Every member gets 100 points, granted exactly once, the first
  // time their principal is seen (see ensureBalance below, called
  // from requireCaller on every authenticated call).

  let STARTING_POINTS : Nat = 100;

  var balances : [(Principal, Nat)] = [];

  func findBalanceEntry(p : Principal) : ?(Principal, Nat) {
    Array.find<(Principal, Nat)>(
      balances,
      func(entry : (Principal, Nat)) : Bool {
        entry.0 == p
      },
    );
  };

  func ensureBalance(p : Principal) : Nat {
    switch (findBalanceEntry(p)) {

      case (?entry) {
        entry.1;
      };

      case null {
        balances := appendOne(balances, (p, STARTING_POINTS));
        STARTING_POINTS;
      };
    };
  };

  func setBalance(p : Principal, amount : Nat) {
    var found = false;

    balances := Array.map<(Principal, Nat), (Principal, Nat)>(
      balances,
      func(entry : (Principal, Nat)) : (Principal, Nat) {
        if (entry.0 == p) {
          found := true;
          (p, amount);
        } else {
          entry;
        };
      },
    );

    if (not found) {
      balances := appendOne(balances, (p, amount));
    };
  };

  // ── Tips ────────────────────────────────────────────────

  public type TipRecord = {
    from : Principal;
    to : Principal;
    amount : Nat;
    noteId : Nat;
    timestamp : Int;
  };

  var tips : [TipRecord] = [];

  // The gate's namespace. Do NOT change it: it decides every user's
  // principal, so changing it would give everyone a new, empty account.
  transient let APP_NAMESPACE = "https://memphis.mercaturaforum.com";

  // ── Web addresses allowed to sign in with a passkey ──────────────
  // Exactly as the browser shows it: https://, no trailing slash, no path.
  // Put your Vercel PRODUCTION domain here (Vercel → Project → Domains).
  // Preview links (my-dapp-2-<random>-…vercel.app) change on every deploy,
  // so each one would need adding; use the production domain instead.
  transient let ALLOWED_ORIGINS : [Text] = [
    "https://memphis.mercaturaforum.com", // Thebes gateway
    "https://my-dapp-2-a0yobl301-abdelrahman-essam1.vercel.app", // Vercel deployment from the screenshot
  ];

  func isAllowedOrigin(origin : Text) : Bool {
    Array.find<Text>(ALLOWED_ORIGINS, func(o : Text) : Bool { o == origin }) != null;
  };

  let gate = MemphisAuth.initFromCid(921, APP_NAMESPACE, 0);

  // ── Username + password (a second way into a passkey account) ──
  //
  // A person signs in with their passkey once, then calls setPassword to
  // attach a username and password to that SAME principal. Afterwards
  // loginWithPassword opens a session for that principal without a passkey.
  //
  // The password never reaches the chain: the browser stretches it with
  // PBKDF2 (salted with the username) into a 32-byte key and sends that key
  // as hex. The contract stores only SHA-256 of the key, and only SHA-256 of
  // each session token, so reading the contract's state does not give anyone
  // a way to log in.

  public type PasswordLogin = {
    username : Text;
    principal : Principal;
    keyHash : Blob;
  };

  public type PasswordSession = {
    tokenHash : Blob;
    principal : Principal;
    expiresAt : Int;
  };

  public type FailedLogins = {
    username : Text;
    count : Nat;
    lockedUntil : Int;
  };

  var passwordLogins : [PasswordLogin] = [];
  var nextPasswordAccount : Nat = 0;

  // A brand-new account made with username + password (no passkey) needs its
  // own principal. Derive a unique 29-byte one from the username and a counter.
  // Its last byte (0x7f) is not used by any Internet Computer principal kind,
  // so it can never collide with a passkey user's principal.
  func newPasswordPrincipal(username : Text) : Principal {
    let h = Blob.toArray(
      Sha256.hash(Text.encodeUtf8("thebes-notes/password-account/v1|" # username # "|" # Nat.toText(nextPasswordAccount)))
    );
    nextPasswordAccount += 1;
    let bytes = Array.tabulate<Nat8>(29, func(i : Nat) : Nat8 { if (i < 28) h[i] else (0x7f : Nat8) });
    Principal.fromBlob(Array.toBlob(bytes));
  };

  func startPasswordSession(sessionToken : Blob, principal : Principal, now : Int) {
    let live = Array.filter<PasswordSession>(passwordSessions, func(s : PasswordSession) : Bool { s.expiresAt > now });
    passwordSessions := appendOne(live, {
      tokenHash = Sha256.hash(sessionToken);
      principal;
      expiresAt = now + SESSION_NS;
    });
  };
  var passwordSessions : [PasswordSession] = [];
  var failedLogins : [FailedLogins] = [];

  transient let SESSION_NS : Int = 7 * 24 * 60 * 60 * 1_000_000_000; // 7 days
  transient let LOCK_NS : Int = 5 * 60 * 1_000_000_000; // 5 minutes
  transient let MAX_FAILURES : Nat = 5;

  func keyHashFor(username : Text, keyHex : Text) : Blob {
    Sha256.hash(Text.encodeUtf8("thebes-notes/password/v1|" # username # "|" # keyHex));
  };

  func isValidUsername(u : Text) : Bool {
    if (u.size() < 3 or u.size() > 32) return false;
    for (c in u.chars()) {
      let ok = (c >= 'a' and c <= 'z') or (c >= '0' and c <= '9') or c == '_' or c == '.' or c == '-';
      if (not ok) return false;
    };
    true;
  };

  func isValidKeyHex(k : Text) : Bool {
    if (k.size() != 64) return false;
    for (c in k.chars()) {
      let ok = (c >= '0' and c <= '9') or (c >= 'a' and c <= 'f');
      if (not ok) return false;
    };
    true;
  };

  func findPasswordSession(token : Blob) : ?Principal {
    if (passwordSessions.size() == 0) return null;
    let th = Sha256.hash(token);
    let now = Time.now();
    switch (
      Array.find<PasswordSession>(
        passwordSessions,
        func(s : PasswordSession) : Bool { s.tokenHash == th and s.expiresAt > now },
      )
    ) {
      case (?s) { ?s.principal };
      case null { null };
    };
  };

  func failuresFor(username : Text) : ?FailedLogins {
    Array.find<FailedLogins>(failedLogins, func(f : FailedLogins) : Bool { f.username == username });
  };

  func recordFailure(username : Text, now : Int) {
    let count = switch (failuresFor(username)) {
      case (?f) { f.count + 1 };
      case null { 1 };
    };
    let lockedUntil = if (count >= MAX_FAILURES) { now + LOCK_NS } else { 0 };
    let others = Array.filter<FailedLogins>(failedLogins, func(f : FailedLogins) : Bool { f.username != username });
    failedLogins := appendOne(others, { username; count = if (count >= MAX_FAILURES) 0 else count; lockedUntil });
  };

  func clearFailures(username : Text) {
    failedLogins := Array.filter<FailedLogins>(failedLogins, func(f : FailedLogins) : Bool { f.username != username });
  };

  // Accepts either a Memphis passkey token or a password session token.
  func requireCaller(token : Blob, origin : Text) : async* Principal {
    switch (findPasswordSession(token)) {
      case (?p) {
        ignore ensureBalance(p);
        p;
      };
      case null { await* requireMemphisCaller(token, origin) };
    };
  };

  // Accepts ONLY a Memphis passkey token. Used for changing login settings,
  // so a password session can never replace or remove the password itself.
  func requireMemphisCaller(token : Blob, origin : Text) : async* Principal {
    // A passkey token is minted for the web address the app runs on, and
    // Memphis only accepts it for that exact address. The frontend sends its
    // address (`origin`); we accept it only if it is on the allowlist, so a
    // copycat site cannot use tokens it collected on its own address.
    if (not isAllowedOrigin(origin)) {
      Runtime.trap("origin not allowed: " # origin # " - add it to ALLOWED_ORIGINS in backend/Backend.mo");
    };
    switch (await* MemphisAuth.verifyWithAudience(gate, token, origin)) {

      case (#ok(identity)) {
        ignore ensureBalance(identity.principal);
        identity.principal;
      };

      case (#err(#Expired)) {
        Runtime.trap("session expired - please sign in again");
      };

      case (#err(#Memphis(err))) {
        switch (err) {

          case (#NotAuthenticated) {
            Runtime.trap("Memphis: NotAuthenticated");
          };

          case (#Unauthorized) {
            Runtime.trap("Memphis: Unauthorized");
          };

          case (#SessionExpired) {
            Runtime.trap("Memphis: SessionExpired");
          };

          case (#ChallengeExpired) {
            Runtime.trap("Memphis: ChallengeExpired");
          };

          case (#AnchorNotFound) {
            Runtime.trap("Memphis: AnchorNotFound");
          };

          case (#FactorNotFound) {
            Runtime.trap("Memphis: FactorNotFound");
          };

          case (#InsufficientFactors) {
            Runtime.trap("Memphis: InsufficientFactors");
          };

          case (#DuplicateCredential) {
            Runtime.trap("Memphis: DuplicateCredential");
          };

          case (#InvalidArgument(msg)) {
            Runtime.trap("Memphis: InvalidArgument - " # msg);
          };

          case (#InvariantViolation(e)) {
            Runtime.trap(
              "Memphis: InvariantViolation - "
              # e.id
              # " - "
              # e.details
            );
          };
        };
      };
    };
  };

  /// Attach (or change) a username + password for the passkey account that
  /// owns `token`. Must be called with a passkey session. Changing it signs
  /// out every existing password session for this account.
  public func setPassword(token : Blob, origin : Text, username : Text, keyHex : Text) : async Bool {
    let caller = await* requireMemphisCaller(token, origin);
    let u = Text.toLower(username);

    if (not isValidUsername(u)) {
      Runtime.trap("username must be 3-32 characters: a-z, 0-9, dot, dash or underscore");
    };
    if (not isValidKeyHex(keyHex)) {
      Runtime.trap("invalid password key");
    };

    switch (Array.find<PasswordLogin>(passwordLogins, func(l : PasswordLogin) : Bool { l.username == u })) {
      case (?l) {
        if (l.principal != caller) { Runtime.trap("username already taken") };
      };
      case null {};
    };

    let others = Array.filter<PasswordLogin>(passwordLogins, func(l : PasswordLogin) : Bool { l.principal != caller });
    passwordLogins := appendOne(others, { username = u; principal = caller; keyHash = keyHashFor(u, keyHex) });
    passwordSessions := Array.filter<PasswordSession>(passwordSessions, func(s : PasswordSession) : Bool { s.principal != caller });
    clearFailures(u);
    true;
  };

  /// Remove the username + password from this account. Passkey session only.
  public func removePassword(token : Blob, origin : Text) : async Bool {
    let caller = await* requireMemphisCaller(token, origin);
    let before = passwordLogins.size();
    passwordLogins := Array.filter<PasswordLogin>(passwordLogins, func(l : PasswordLogin) : Bool { l.principal != caller });
    passwordSessions := Array.filter<PasswordSession>(passwordSessions, func(s : PasswordSession) : Bool { s.principal != caller });
    passwordLogins.size() < before;
  };

  /// Sign in with username + password. `sessionToken` is 32 random bytes made
  /// by the browser; on success it becomes valid for 7 days. Returns false
  /// for a wrong username or password (false, not a trap, so the failed
  /// attempt is recorded). Five failures lock the username for 5 minutes.
  public func loginWithPassword(sessionToken : Blob, _origin : Text, username : Text, keyHex : Text) : async Bool {
    let u = Text.toLower(username);
    let now = Time.now();

    if (sessionToken.size() != 32) {
      Runtime.trap("invalid session token");
    };

    switch (failuresFor(u)) {
      case (?f) {
        if (f.lockedUntil > now) {
          Runtime.trap("too many failed attempts - try again in a few minutes");
        };
      };
      case null {};
    };

    let found = Array.find<PasswordLogin>(passwordLogins, func(l : PasswordLogin) : Bool { l.username == u });

    switch (found) {
      case null {
        recordFailure(u, now);
        false;
      };
      case (?login) {
        if (not isValidKeyHex(keyHex) or login.keyHash != keyHashFor(u, keyHex)) {
          recordFailure(u, now);
          return false;
        };

        clearFailures(u);
        startPasswordSession(sessionToken, login.principal, now);
        ignore ensureBalance(login.principal);
        true;
      };
    };
  };

  /// Create a NEW account with just a username + password (no passkey).
  /// `sessionToken` is 32 random bytes made by the browser; on success the
  /// person is signed in right away. Gets the usual 100 starting points.
  public func registerWithPassword(sessionToken : Blob, _origin : Text, username : Text, keyHex : Text) : async Bool {
    let u = Text.toLower(username);
    let now = Time.now();

    if (sessionToken.size() != 32) {
      Runtime.trap("invalid session token");
    };
    if (not isValidUsername(u)) {
      Runtime.trap("username must be 3-32 characters: a-z, 0-9, dot, dash or underscore");
    };
    if (not isValidKeyHex(keyHex)) {
      Runtime.trap("invalid password key");
    };
    if (Array.find<PasswordLogin>(passwordLogins, func(l : PasswordLogin) : Bool { l.username == u }) != null) {
      Runtime.trap("username already taken");
    };

    let principal = newPasswordPrincipal(u);
    passwordLogins := appendOne(passwordLogins, { username = u; principal; keyHash = keyHashFor(u, keyHex) });
    startPasswordSession(sessionToken, principal, now);
    ignore ensureBalance(principal);
    true;
  };

  /// Change the password by giving the current one. Works from any session.
  /// Returns false if the current password is wrong. Signs out every OTHER
  /// password session of this account.
  public func changePassword(token : Blob, origin : Text, currentKeyHex : Text, newKeyHex : Text) : async Bool {
    let caller = await* requireCaller(token, origin);
    let now = Time.now();

    let login = switch (Array.find<PasswordLogin>(passwordLogins, func(l : PasswordLogin) : Bool { l.principal == caller })) {
      case (?l) { l };
      case null { Runtime.trap("no password is set on this account") };
    };

    switch (failuresFor(login.username)) {
      case (?f) {
        if (f.lockedUntil > now) {
          Runtime.trap("too many failed attempts - try again in a few minutes");
        };
      };
      case null {};
    };

    if (not isValidKeyHex(currentKeyHex) or login.keyHash != keyHashFor(login.username, currentKeyHex)) {
      recordFailure(login.username, now);
      return false;
    };
    if (not isValidKeyHex(newKeyHex)) {
      Runtime.trap("invalid password key");
    };

    clearFailures(login.username);
    let others = Array.filter<PasswordLogin>(passwordLogins, func(l : PasswordLogin) : Bool { l.principal != caller });
    passwordLogins := appendOne(others, { login with keyHash = keyHashFor(login.username, newKeyHex) });
    let keep = Sha256.hash(token);
    passwordSessions := Array.filter<PasswordSession>(
      passwordSessions,
      func(s : PasswordSession) : Bool { s.principal != caller or s.tokenHash == keep },
    );
    true;
  };

  /// End a password session.
  public func logoutPassword(sessionToken : Blob, _origin : Text) : async Bool {
    let th = Sha256.hash(sessionToken);
    let before = passwordSessions.size();
    passwordSessions := Array.filter<PasswordSession>(passwordSessions, func(s : PasswordSession) : Bool { s.tokenHash != th });
    passwordSessions.size() < before;
  };

  /// The username attached to this account, or "" if none is set.
  public func getUsername(token : Blob, origin : Text) : async Text {
    let caller = await* requireCaller(token, origin);
    switch (Array.find<PasswordLogin>(passwordLogins, func(l : PasswordLogin) : Bool { l.principal == caller })) {
      case (?l) { l.username };
      case null { "" };
    };
  };

  public func add(
    token : Blob,
    origin : Text,
    title : Text,
    body : Text,
    category : Text,
    color : Text
  ) : async Nat {
    let caller = await* requireCaller(token, origin);
    let now = Time.now();

    let newNote : Note = {
      id = nextId;
      title;
      body;
      category;
      pinned = false;
      isShared = false;
      color;
      createdAt = now;
      updatedAt = now;
      owner = caller;
    };

    notes := appendOne(notes, newNote);
    nextId += 1;

    newNote.id;
  };

  public func list(token : Blob, origin : Text) : async [Note] {
    let caller = await* requireCaller(token, origin);

    Array.filter<Note>(
      notes,
      func(n : Note) : Bool {
        n.owner == caller
      },
    );
  };

  public func feed(token : Blob, origin : Text) : async [Note] {
    let _caller = await* requireCaller(token, origin);

    Array.filter<Note>(
      notes,
      func(n : Note) : Bool {
        n.isShared
      },
    );
  };

  public func getBalance(token : Blob, origin : Text) : async Nat {
    let caller = await* requireCaller(token, origin);

    ensureBalance(caller);
  };

  public func tip(
    token : Blob,
    origin : Text,
    noteId : Nat,
    amount : Nat
  ) : async Bool {
    let caller = await* requireCaller(token, origin);

    let found = Array.find<Note>(
      notes,
      func(n : Note) : Bool {
        n.id == noteId
      },
    );

    switch (found) {

      case null {
        Runtime.trap("note not found");
      };

      case (?note) {

        if (note.owner == caller) {
          Runtime.trap("cannot tip your own note");
        };

        if (amount == 0) {
          Runtime.trap("tip amount must be greater than 0");
        };

        let senderBalance = ensureBalance(caller);

        if (senderBalance < amount) {
          Runtime.trap("insufficient points");
        };

        let receiverBalance = ensureBalance(note.owner);

        setBalance(caller, senderBalance - amount);
        setBalance(note.owner, receiverBalance + amount);

        let record : TipRecord = {
          from = caller;
          to = note.owner;
          amount;
          noteId;
          timestamp = Time.now();
        };

        tips := appendOne(tips, record);

        true;
      };
    };
  };

  public func getMyTips(token : Blob, origin : Text) : async [TipRecord] {
    let caller = await* requireCaller(token, origin);

    Array.filter<TipRecord>(
      tips,
      func(t : TipRecord) : Bool {
        t.from == caller or t.to == caller
      },
    );
  };

  public func edit(
    token : Blob,
    origin : Text,
    id : Nat,
    title : Text,
    body : Text,
    category : Text,
    color : Text
  ) : async Bool {
    let caller = await* requireCaller(token, origin);

    let found = Array.find<Note>(
      notes,
      func(n : Note) : Bool {
        n.id == id
      },
    );

    switch (found) {

      case null {
        false;
      };

      case (?note) {

        if (note.owner != caller) {
          Runtime.trap("not your note");
        };

        let updated : Note = {
          note with
          title;
          body;
          category;
          color;
          updatedAt = Time.now();
        };

        notes := Array.map<Note, Note>(
          notes,
          func(n : Note) : Note {
            if (n.id == id) {
              updated
            } else {
              n
            };
          },
        );

        true;
      };
    };
  };

  public func togglePin(
    token : Blob,
    origin : Text,
    id : Nat
  ) : async Bool {
    let caller = await* requireCaller(token, origin);

    let found = Array.find<Note>(
      notes,
      func(n : Note) : Bool {
        n.id == id
      },
    );

    switch (found) {

      case null {
        false;
      };

      case (?note) {

        if (note.owner != caller) {
          Runtime.trap("not your note");
        };

        let updated : Note = {
          note with
          pinned = not note.pinned;
          updatedAt = Time.now();
        };

        notes := Array.map<Note, Note>(
          notes,
          func(n : Note) : Note {
            if (n.id == id) {
              updated
            } else {
              n
            };
          },
        );

        true;
      };
    };
  };

  public func toggleShare(
    token : Blob,
    origin : Text,
    id : Nat
  ) : async Bool {
    let caller = await* requireCaller(token, origin);

    let found = Array.find<Note>(
      notes,
      func(n : Note) : Bool {
        n.id == id
      },
    );

    switch (found) {

      case null {
        false;
      };

      case (?note) {

        if (note.owner != caller) {
          Runtime.trap("not your note");
        };

        let updated : Note = {
          note with
          isShared = not note.isShared;
          updatedAt = Time.now();
        };

        notes := Array.map<Note, Note>(
          notes,
          func(n : Note) : Note {
            if (n.id == id) {
              updated
            } else {
              n
            };
          },
        );

        true;
      };
    };
  };

  public func remove(
    token : Blob,
    origin : Text,
    id : Nat
  ) : async Bool {
    let caller = await* requireCaller(token, origin);

    let found = Array.find<Note>(
      notes,
      func(n : Note) : Bool {
        n.id == id
      },
    );

    switch (found) {

      case null {
        false;
      };

      case (?note) {

        if (note.owner != caller) {
          Runtime.trap("not your note");
        };

        let oldSize = notes.size();

        notes := Array.filter<Note>(
          notes,
          func(n : Note) : Bool {
            n.id != id
          },
        );

        notes.size() < oldSize;
      };
    };
  };
};
