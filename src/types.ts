export interface Bookmark {
  id: string;
  url: string;
  title: string;
  content: string;
  category: string;
  status: 'unread' | 'reading' | 'read';
  progress: number;
  created_at: string;
  updated_at: string;
  isOffline?: boolean;
}

export interface Highlight {
  id: string;
  bookmark_id: string;
  text: string;
  color: string;
  created_at: string;
}

export type BookmarkCategory = 'to read' | 'reading' | 'would read' | string;
