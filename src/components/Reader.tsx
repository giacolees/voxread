import React, { useState } from 'react';
import { Bookmark, Highlight } from '../types';
import Markdown from 'react-markdown';
import { VoiceHighlighter } from './VoiceHighlighter';

interface ReaderProps {
  bookmark: Bookmark;
  highlights: Highlight[];
  onAddHighlight: (text: string) => void;
  onClose: () => void;
}

export const Reader: React.FC<ReaderProps> = ({ bookmark, highlights, onAddHighlight, onClose }) => {
  const [fontSize, setFontSize] = useState(18);

  // Simple highlighting logic: wrap text in a mark tag if it matches a highlight
  const renderContent = () => {
    let content = bookmark.content;
    
    // This is a very basic implementation. In a real app, we'd use a more robust
    // way to handle overlapping highlights and HTML parsing.
    return (
      <div 
        className="prose prose-indigo max-w-none"
        style={{ fontSize: `${fontSize}px` }}
      >
        <Markdown>{content}</Markdown>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-white z-40 flex flex-col">
      <header className="p-4 border-bottom flex justify-between items-center bg-stone-50">
        <button onClick={onClose} className="text-stone-600 font-medium">Close</button>
        <h2 className="text-sm font-semibold truncate max-w-[200px]">{bookmark.title}</h2>
        <div className="flex gap-4">
          <button onClick={() => setFontSize(s => Math.max(12, s - 2))} className="px-2">A-</button>
          <button onClick={() => setFontSize(s => Math.min(32, s + 2))} className="px-2">A+</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 md:p-12 max-w-3xl mx-auto w-full">
        {renderContent()}
        
        {highlights.length > 0 && (
          <section className="mt-12 pt-8 border-t border-stone-200">
            <h3 className="text-lg font-serif italic mb-4">Your Highlights</h3>
            <ul className="space-y-4">
              {highlights.map(h => (
                <li key={h.id} className="bg-yellow-50 p-3 border-l-4 border-yellow-400 text-stone-700 italic">
                  "{h.text}"
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <VoiceHighlighter isActive={true} onHighlight={onAddHighlight} />
    </div>
  );
};
