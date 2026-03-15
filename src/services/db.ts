import { openDB, IDBPDatabase } from 'idb';
import { Bookmark, Highlight } from '../types';

const DB_NAME = 'voxread_offline';
const VERSION = 2;

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
      if (!db.objectStoreNames.contains('downloads')) {
        db.createObjectStore('downloads', { keyPath: 'id' });
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

export interface DownloadRecord {
  id: string; // bookmark_id
  title: string;
  content_type: 'markdown' | 'pdf';
  downloaded_at: string;
}

export async function saveDownload(record: DownloadRecord) {
  const db = await initDB();
  await db.put('downloads', record);
}

export async function getDownloadedIds(): Promise<Set<string>> {
  const db = await initDB();
  const all = await db.getAllKeys('downloads');
  return new Set(all as string[]);
}

export async function deleteDownload(id: string) {
  const db = await initDB();
  await db.delete('downloads', id);
}

export async function getDownloads(): Promise<DownloadRecord[]> {
  const db = await initDB();
  const all: DownloadRecord[] = await db.getAll('downloads');
  return all.sort((a, b) => b.downloaded_at.localeCompare(a.downloaded_at));
}

export async function getBookmarkOffline(id: string): Promise<Bookmark | undefined> {
  const db = await initDB();
  return db.get('bookmarks', id);
}
