import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { extensionPath } from "@vlcn.io/crsqlite/nodejs-helper.js";
import { Bonjour } from "bonjour-service";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT ?? "3000", 10);

// Open database and load cr-sqlite extension
// Port-scoped filename so two instances on the same machine don't share a DB
const db = new Database(`voxread-${PORT}.db`);
db.loadExtension(extensionPath);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT UNIQUE,
    name TEXT
  );

  CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT,
    url TEXT,
    title TEXT,
    content TEXT,
    category TEXT DEFAULT 'to read',
    status TEXT DEFAULT 'unread',
    progress REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS highlights (
    id TEXT PRIMARY KEY NOT NULL,
    bookmark_id TEXT,
    text TEXT,
    color TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Device identity (persists across restarts)
  CREATE TABLE IF NOT EXISTS device (
    id   TEXT PRIMARY KEY,
    name TEXT
  );
  INSERT OR IGNORE INTO device (id, name)
  VALUES (lower(hex(randomblob(16))), 'VoxRead-' || lower(hex(randomblob(4))));

  -- Track last-synced version per peer
  CREATE TABLE IF NOT EXISTS sync_state (
    peer_id        TEXT PRIMARY KEY,
    db_version     INTEGER NOT NULL DEFAULT 0,
    last_synced_at INTEGER
  );

  -- Register tables as CRDTs (idempotent)
  SELECT crsql_as_crr('bookmarks');
  SELECT crsql_as_crr('highlights');
`);

// Read device identity
const { id: DEVICE_ID, name: DEVICE_NAME } = db
  .prepare("SELECT id, name FROM device LIMIT 1")
  .get() as { id: string; name: string };

console.log(`Device: ${DEVICE_NAME} (${DEVICE_ID})`);

// Peer tracking: peerId -> peerUrl
const knownPeers = new Map<string, string>();

// ── Serialization helpers for crsql_changes ──────────────────────────────────

function encodeRow(row: any) {
  return {
    table:       row.table,
    pk:          Buffer.isBuffer(row.pk) ? row.pk.toString("hex") : row.pk,
    cid:         row.cid,
    val:         Buffer.isBuffer(row.val) ? { __hex: row.val.toString("hex") } : row.val,
    col_version: row.col_version,
    db_version:  row.db_version,
    site_id:     Buffer.isBuffer(row.site_id) ? row.site_id.toString("hex") : row.site_id,
    cl:          row.cl,
    seq:         row.seq,
  };
}

function decodeRow(row: any) {
  return {
    table:       row.table,
    pk:          typeof row.pk === "string" ? Buffer.from(row.pk, "hex") : row.pk,
    cid:         row.cid,
    val:         row.val === null || row.val === undefined
                   ? null
                   : row.val && typeof row.val === "object" && "__hex" in row.val
                   ? Buffer.from(row.val.__hex, "hex")
                   : row.val,
    col_version: row.col_version,
    db_version:  row.db_version,
    site_id:     typeof row.site_id === "string" ? Buffer.from(row.site_id, "hex") : row.site_id,
    cl:          row.cl,
    seq:         row.seq,
  };
}

// ── Sync protocol ─────────────────────────────────────────────────────────────

async function syncWithPeer(peerUrl: string, peerId: string): Promise<void> {
  try {
    // 1. Read last-synced db_version for this peer
    const state = db
      .prepare("SELECT db_version FROM sync_state WHERE peer_id = ?")
      .get(peerId) as { db_version: number } | undefined;
    const since = state?.db_version ?? 0;

    // 2. Pull changes from peer
    const changesRes = await fetch(
      `${peerUrl}/sync/changes?since=${since}&requesterId=${DEVICE_ID}`
    );
    if (!changesRes.ok) throw new Error(`Pull failed: ${changesRes.status}`);
    const { changes, dbVersion: peerDbVersion } = (await changesRes.json()) as {
      changes: any[];
      dbVersion: number;
    };

    // 3. Apply received changes inside a transaction
    if (changes.length > 0) {
      const applyChange = db.prepare(
        "INSERT INTO crsql_changes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      db.transaction((rows: any[]) => {
        for (const row of rows) {
          const d = decodeRow(row);
          applyChange.run(
            d.table, d.pk, d.cid, d.val,
            d.col_version, d.db_version, d.site_id, d.cl, d.seq
          );
        }
      })(changes);
    }

    // 4. Update sync_state with peer's reported dbVersion
    db.prepare(
      "INSERT OR REPLACE INTO sync_state (peer_id, db_version, last_synced_at) VALUES (?, ?, ?)"
    ).run(peerId, peerDbVersion, Date.now());

    // 5. Push our own changes since `since` to peer
    const ourChanges = db
      .prepare("SELECT * FROM crsql_changes WHERE db_version > ?")
      .all(since);

    if (ourChanges.length > 0) {
      const pushRes = await fetch(`${peerUrl}/sync/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changes: ourChanges.map(encodeRow),
          senderId: DEVICE_ID,
        }),
      });
      if (!pushRes.ok) throw new Error(`Push failed: ${pushRes.status}`);
    }
  } catch (err) {
    console.error(
      `Sync with ${peerUrl} failed:`,
      err instanceof Error ? err.message : err
    );
  }
}

// ── Express server ────────────────────────────────────────────────────────────

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));

  const MOCK_USER_ID = "user_123";

  // ── Existing API routes ──────────────────────────────────────────────────

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/bookmarks", (_req, res) => {
    const bookmarks = db
      .prepare("SELECT * FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC")
      .all(MOCK_USER_ID);
    res.json(bookmarks);
  });

  app.post("/api/bookmarks", (req, res) => {
    const { id, url, title, content, category } = req.body;
    db.prepare(`
      INSERT INTO bookmarks (id, user_id, url, title, content, category)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title,
        content=excluded.content,
        category=excluded.category,
        updated_at=CURRENT_TIMESTAMP
    `).run(id, MOCK_USER_ID, url, title, content, category);
    res.json({ success: true });
    // Fan-out sync to all known peers (fire-and-forget)
    for (const [peerId, peerUrl] of knownPeers.entries()) {
      syncWithPeer(peerUrl, peerId).catch(() => {});
    }
  });

  app.delete("/api/bookmarks/:id", (req, res) => {
    db.prepare("DELETE FROM bookmarks WHERE id = ? AND user_id = ?").run(
      req.params.id,
      MOCK_USER_ID
    );
    res.json({ success: true });
    for (const [peerId, peerUrl] of knownPeers.entries()) {
      syncWithPeer(peerUrl, peerId).catch(() => {});
    }
  });

  app.get("/api/highlights/:bookmarkId", (req, res) => {
    const highlights = db
      .prepare("SELECT * FROM highlights WHERE bookmark_id = ?")
      .all(req.params.bookmarkId);
    res.json(highlights);
  });

  app.post("/api/highlights", (req, res) => {
    const { id, bookmarkId, text, color } = req.body;
    db.prepare(
      "INSERT INTO highlights (id, bookmark_id, text, color) VALUES (?, ?, ?, ?)"
    ).run(id, bookmarkId, text, color);
    res.json({ success: true });
    for (const [peerId, peerUrl] of knownPeers.entries()) {
      syncWithPeer(peerUrl, peerId).catch(() => {});
    }
  });

  app.get("/api/fetch-content", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") return res.status(400).send("URL required");
    try {
      const response = await fetch(url);
      const html = await response.text();
      res.json({ html });
    } catch {
      res.status(500).json({ error: "Failed to fetch content" });
    }
  });

  // ── Sync endpoints ───────────────────────────────────────────────────────

  app.get("/sync/info", (_req, res) => {
    const { v: dbVersion } = db
      .prepare("SELECT crsql_db_version() as v")
      .get() as { v: number };
    res.json({ deviceId: DEVICE_ID, deviceName: DEVICE_NAME, dbVersion });
  });

  app.get("/sync/changes", (req, res) => {
    const since = parseInt(String(req.query.since ?? "0"), 10);
    const { v: dbVersion } = db
      .prepare("SELECT crsql_db_version() as v")
      .get() as { v: number };
    const changes = db
      .prepare("SELECT * FROM crsql_changes WHERE db_version > ?")
      .all(since);
    res.json({ changes: changes.map(encodeRow), dbVersion });
  });

  app.post("/sync/apply", (req, res) => {
    const { changes, senderId } = req.body as {
      changes: any[];
      senderId: string;
    };
    if (!Array.isArray(changes) || changes.length === 0) {
      return res.json({ success: true });
    }
    try {
      const applyChange = db.prepare(
        "INSERT INTO crsql_changes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      db.transaction((rows: any[]) => {
        for (const row of rows) {
          const d = decodeRow(row);
          applyChange.run(
            d.table, d.pk, d.cid, d.val,
            d.col_version, d.db_version, d.site_id, d.cl, d.seq
          );
        }
      })(changes);

      if (senderId) {
        const { v: dbVersion } = db
          .prepare("SELECT crsql_db_version() as v")
          .get() as { v: number };
        db.prepare(
          "INSERT OR REPLACE INTO sync_state (peer_id, db_version, last_synced_at) VALUES (?, ?, ?)"
        ).run(senderId, dbVersion, Date.now());
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Apply changes failed:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/sync/status", (_req, res) => {
    const peers = Array.from(knownPeers.keys()).map((peerId) => {
      const state = db
        .prepare("SELECT last_synced_at as lastSynced FROM sync_state WHERE peer_id = ?")
        .get(peerId) as { lastSynced: number } | undefined;
      return {
        id: peerId,
        name: `VoxRead-${peerId.slice(0, 4)}`,
        lastSynced: state?.lastSynced ?? 0,
      };
    });
    res.json({ peers });
  });

  // ── Vite / static serving ────────────────────────────────────────────────

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    startMDNS();
  });
}

// ── mDNS advertising + discovery ─────────────────────────────────────────────

function startMDNS() {
  const bonjour = new Bonjour();

  bonjour.publish({
    name: DEVICE_NAME,
    type: "voxread",
    protocol: "tcp",
    port: PORT,
    txt: { deviceId: DEVICE_ID },
  });

  const browser = bonjour.find({ type: "voxread", protocol: "tcp" });

  browser.on("up", (svc) => {
    const peerId = svc.txt?.deviceId;
    if (!peerId || peerId === DEVICE_ID) return;
    // Prefer IPv4; IPv6 link-local addresses require zone IDs and can't be used in plain URLs
    const ipv4 = svc.addresses?.find((a) => !a.includes(":"));
    const host = ipv4 ?? svc.host;
    const peerUrl = `http://${host}:${svc.port}`;
    console.log(`Discovered peer: ${DEVICE_NAME} → ${peerId} at ${peerUrl}`);
    knownPeers.set(peerId, peerUrl);
    syncWithPeer(peerUrl, peerId);
  });

  browser.on("down", (svc) => {
    const peerId = svc.txt?.deviceId;
    if (peerId) {
      console.log(`Peer went offline: ${peerId}`);
      knownPeers.delete(peerId);
    }
  });

  // Catch up with already-visible peers 2 s after startup
  setTimeout(() => {
    for (const [id, url] of knownPeers) {
      syncWithPeer(url, id);
    }
  }, 2000);

  // Heartbeat: evict peers that no longer respond
  setInterval(async () => {
    for (const [peerId, peerUrl] of knownPeers.entries()) {
      try {
        const res = await fetch(`${peerUrl}/sync/info`, {
          signal: AbortSignal.timeout(2000),
        });
        if (!res.ok) knownPeers.delete(peerId);
      } catch {
        console.log(`Peer ${peerId} unreachable — removing`);
        knownPeers.delete(peerId);
      }
    }
  }, 8000);

  // Graceful shutdown
  process.on("SIGINT", () => {
    bonjour.unpublishAll();
    bonjour.destroy();
    process.exit();
  });
}

startServer();
