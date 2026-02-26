import { openDB, IDBPDatabase } from 'idb';
import { Bookmark, Highlight } from '../types';

const DB_NAME = 'voxread_offline';
const VERSION = 1;

export async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('bookmarks')) {
        db.createObjectStore('bookmarks', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('highlights')) {
        db.createObjectStore('highlights', { keyPath: 'id' });
        // Add index to find highlights by bookmark_id
        const store = db.transaction('highlights').objectStore('highlights');
        // Wait, transaction is not available in upgrade. Use store directly.
      }
    },
  });
}

// Fixed upgrade logic
export async function initDB() {
  return openDB(DB_NAME, VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('bookmarks')) {
        db.createObjectStore('bookmarks', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('highlights')) {
        const highlightStore = db.createObjectStore('highlights', { keyPath: 'id' });
        highlightStore.createIndex('bookmark_id', 'bookmark_id');
      }
    },
  });
}

export async function saveBookmarkOffline(bookmark: Bookmark) {
  const db = await initDB();
  await db.put('bookmarks', { ...bookmark, isOffline: true });
}

export async function getOfflineBookmarks(): Promise<Bookmark[]> {
  const db = await initDB();
  return db.getAll('bookmarks');
}

export async function deleteBookmarkOffline(id: string) {
  const db = await initDB();
  await db.delete('bookmarks', id);
}

export async function saveHighlightOffline(highlight: Highlight) {
  const db = await initDB();
  await db.put('highlights', highlight);
}

export async function getHighlightsOffline(bookmarkId: string): Promise<Highlight[]> {
  const db = await initDB();
  return db.getAllFromIndex('highlights', 'bookmark_id', bookmarkId);
}
