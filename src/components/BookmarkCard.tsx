import React, { useState, useRef, useEffect } from 'react';
import { Bookmark } from '../types';
import { BookOpen, Clock, MoreVertical, HardDriveDownload, Download, Trash2 } from 'lucide-react';

interface BookmarkCardProps {
  bookmark: Bookmark;
  onRead: (b: Bookmark) => void;
  onDelete: (id: string) => void;
  onSaveOffline: (b: Bookmark) => void;
  onDownloadFile: (b: Bookmark) => void;
  isDownloaded?: boolean;
}

export const BookmarkCard: React.FC<BookmarkCardProps> = ({
  bookmark,
  onRead,
  onDelete,
  onSaveOffline,
  onDownloadFile,
  isDownloaded,
}) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const fileLabel = (bookmark.content_type ?? 'markdown') === 'pdf' ? 'PDF' : 'Markdown';

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex justify-between items-start mb-3">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 bg-stone-100 px-2 py-0.5 rounded">
          {bookmark.category}
        </span>

        <div ref={menuRef} className="relative">
          <button
            onClick={() => setOpen(o => !o)}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
            title="Options"
          >
            <MoreVertical size={16} />
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-stone-200 rounded-xl shadow-lg py-1 z-20">
              <button
                onClick={() => { onSaveOffline(bookmark); setOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
              >
                <HardDriveDownload size={15} className={isDownloaded ? 'text-emerald-600' : 'text-stone-400'} />
                <span>{isDownloaded ? 'Saved offline' : 'Save to local database'}</span>
              </button>
              <button
                onClick={() => { onDownloadFile(bookmark); setOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
              >
                <Download size={15} className="text-stone-400" />
                <span>Download as {fileLabel}</span>
              </button>
              <div className="my-1 border-t border-stone-100" />
              <button
                onClick={() => { onDelete(bookmark.id); setOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={15} />
                <span>Remove</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <h3 className="font-serif text-lg text-stone-800 leading-snug mb-2 line-clamp-2">
        {bookmark.title}
      </h3>

      <div className="flex items-center gap-4 text-xs text-stone-500">
        <div className="flex items-center gap-1">
          <Clock size={14} />
          <span>{new Date(bookmark.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      <button
        onClick={() => onRead(bookmark)}
        className="w-full mt-4 flex items-center justify-center gap-2 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors text-sm font-medium"
      >
        <BookOpen size={16} />
        Read Now
      </button>
    </div>
  );
};
