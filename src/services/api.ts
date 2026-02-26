import { Bookmark, Highlight } from '../types';

const API_BASE = '/api';

export const api = {
  async getBookmarks(): Promise<Bookmark[]> {
    const res = await fetch(`${API_BASE}/bookmarks`);
    return res.json();
  },

  async saveBookmark(bookmark: Partial<Bookmark>): Promise<void> {
    await fetch(`${API_BASE}/bookmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookmark),
    });
  },

  async deleteBookmark(id: string): Promise<void> {
    await fetch(`${API_BASE}/bookmarks/${id}`, { method: 'DELETE' });
  },

  async getHighlights(bookmarkId: string): Promise<Highlight[]> {
    const res = await fetch(`${API_BASE}/highlights/${bookmarkId}`);
    return res.json();
  },

  async saveHighlight(highlight: Partial<Highlight>): Promise<void> {
    await fetch(`${API_BASE}/highlights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(highlight),
    });
  },

  async fetchContent(url: string): Promise<{ html: string }> {
    const res = await fetch(`${API_BASE}/fetch-content?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error('Failed to fetch content');
    return res.json();
  },

  async getSyncStatus(): Promise<{ peers: { id: string; name: string; lastSynced: number }[] }> {
    const res = await fetch('/sync/status');
    if (!res.ok) return { peers: [] };
    return res.json();
  },
};
