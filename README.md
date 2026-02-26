# VoxRead

A local-first reading app that syncs across devices on your LAN — no cloud required.

Save articles, highlights, and reading progress. Everything lives in a SQLite database on each device and syncs automatically with other VoxRead instances on your network via mDNS and CRDTs.

## Features

- **Save articles** from any URL — content is extracted server-side and stored locally
- **Offline reading** — all bookmarks are mirrored to IndexedDB so the app works without a connection
- **LAN sync** — devices discover each other via mDNS (Bonjour) and sync changes using [cr-sqlite](https://github.com/vlcn-io/cr-sqlite) CRDTs (last-write-wins per column, no manual conflict resolution)
- **Voice highlights** — say "highlight [text]" while reading to create a highlight via the Web Speech API
- **Adjustable reader** — font size controls, clean Markdown rendering

## Requirements

- Node.js 22+

If using Homebrew: `brew install node@22` and add `/opt/homebrew/opt/node@22/bin` to your `PATH`.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Running Multiple Instances (LAN Sync)

Start a second instance on a different port — devices on the same network discover each other automatically:

```bash
PORT=3001 npm run dev
```

Each instance gets its own database (`voxread-3000.db`, `voxread-3001.db`). Bookmarks and highlights sync within seconds of any write.

To give a device a custom name (shown in the peers dropdown):

```bash
DEVICE_NAME="MacBook" npm run dev
```

## How Sync Works

1. Each device advertises itself via mDNS (`_voxread._tcp`)
2. When a peer is discovered, a pull-then-push sync runs immediately
3. After every write, changes are fanned out to all known peers
4. A heartbeat every 8 seconds evicts peers that stop responding
5. On restart, the device catches up from any peers already on the network

Conflict resolution is handled by cr-sqlite: concurrent edits to different columns both survive; concurrent edits to the same column resolve deterministically by Lamport clock.

## Scripts

```bash
npm run dev      # Start dev server (Express + Vite on port 3000)
npm run build    # Build frontend for production
npm run lint     # Type-check
npm run clean    # Remove dist/
```
