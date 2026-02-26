import React from 'react';
import { Bookmark } from '../types';
import { BookOpen, Clock, Trash2 } from 'lucide-react';

interface BookmarkCardProps {
  bookmark: Bookmark;
  onRead: (b: Bookmark) => void;
  onDelete: (id: string) => void;
}

export const BookmarkCard: React.FC<BookmarkCardProps> = ({ bookmark, onRead, onDelete }) => {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex justify-between items-start mb-3">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 bg-stone-100 px-2 py-0.5 rounded">
          {bookmark.category}
        </span>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onDelete(bookmark.id)}
            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
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
