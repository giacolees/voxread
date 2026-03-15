import React, { useState, useEffect, useRef } from 'react';
import { Bookmark, Highlight } from '../types';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { VoiceHighlighter } from './VoiceHighlighter';
import * as pdfjsLib from 'pdfjs-dist';
import { Download } from 'lucide-react';
import { saveDownload } from '@/src/services/db';

function applyHighlights(content: string, highlights: Highlight[]): string {
  let result = content;
  for (const h of highlights) {
    if (!h.text) continue;
    const escaped = h.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(
      new RegExp(escaped, 'gi'),
      `<mark class="bg-yellow-200 rounded px-0.5">$&</mark>`
    );
  }
  return result;
}

export function downloadAsFile(bookmark: Bookmark) {
  const safe = bookmark.title.replace(/[/\\?%*:|"<>]/g, '-');
  const contentType = bookmark.content_type ?? 'markdown';
  let blob: Blob;
  let filename: string;
  if (contentType === 'pdf') {
    const bytes = Uint8Array.from(atob(bookmark.content), c => c.charCodeAt(0));
    blob = new Blob([bytes], { type: 'application/pdf' });
    filename = `${safe}.pdf`;
  } else {
    blob = new Blob([bookmark.content], { type: 'text/markdown' });
    filename = `${safe}.md`;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function saveToLocalDb(bookmark: Bookmark) {
  await saveDownload({
    id: bookmark.id,
    title: bookmark.title,
    content_type: bookmark.content_type ?? 'markdown',
    downloaded_at: new Date().toISOString(),
  });
}

export async function downloadBookmark(bookmark: Bookmark) {
  downloadAsFile(bookmark);
  await saveToLocalDb(bookmark);
}

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).href;

interface PdfViewerProps {
  content: string; // Base64-encoded PDF
}

const PdfViewer: React.FC<PdfViewerProps> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const bytes = Uint8Array.from(atob(content), (c) => c.charCodeAt(0));

    pdfjsLib.getDocument({ data: bytes }).promise.then(async (pdf) => {
      if (cancelled || !containerRef.current) return;
      containerRef.current.innerHTML = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        if (cancelled) break;
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.className = 'w-full mb-4 shadow-sm';
        containerRef.current?.appendChild(canvas);
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      }
    });

    return () => { cancelled = true; };
  }, [content]);

  return <div ref={containerRef} className="w-full" />;
};

interface ReaderProps {
  bookmark: Bookmark;
  highlights: Highlight[];
  onAddHighlight: (text: string) => void;
  onClose: () => void;
}

export const Reader: React.FC<ReaderProps> = ({ bookmark, highlights, onAddHighlight, onClose }) => {
  const [fontSize, setFontSize] = useState(18);
  const [selectionPopover, setSelectionPopover] = useState<{ x: number; y: number; text: string } | null>(null);
  const isPdf = (bookmark.content_type ?? 'markdown') === 'pdf';
  const contentRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectionPopover(null);
      return;
    }
    const text = selection.toString().trim();
    if (!text) return;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelectionPopover({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      text,
    });
  };

  const handleHighlightClick = () => {
    if (!selectionPopover) return;
    onAddHighlight(selectionPopover.text);
    window.getSelection()?.removeAllRanges();
    setSelectionPopover(null);
  };

  return (
    <div className="fixed inset-0 bg-white z-40 flex flex-col">
      <header className="p-4 border-bottom flex justify-between items-center bg-stone-50">
        <button onClick={onClose} className="text-stone-600 font-medium">Close</button>
        <h2 className="text-sm font-semibold truncate max-w-[200px]">{bookmark.title}</h2>
        <div className="flex items-center gap-4">
          {!isPdf && (
            <>
              <button onClick={() => setFontSize(s => Math.max(12, s - 2))} className="px-2">A-</button>
              <button onClick={() => setFontSize(s => Math.min(32, s + 2))} className="px-2">A+</button>
            </>
          )}
          <button
            onClick={() => downloadBookmark(bookmark)}
            className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-200 rounded-lg transition-colors"
            title="Download"
          >
            <Download size={18} />
          </button>
        </div>
      </header>

      <main
        className="flex-1 overflow-y-auto p-6 md:p-12 max-w-3xl mx-auto w-full"
        onMouseUp={isPdf ? undefined : handleMouseUp}
        onMouseDown={() => setSelectionPopover(null)}
      >
        {isPdf ? (
          <PdfViewer content={bookmark.content} />
        ) : (
          <div
            ref={contentRef}
            className="prose prose-indigo max-w-none"
            style={{ fontSize: `${fontSize}px` }}
          >
            <Markdown rehypePlugins={[rehypeRaw]}>
              {applyHighlights(bookmark.content, highlights)}
            </Markdown>
          </div>
        )}
      </main>

      {selectionPopover && (
        <button
          onMouseDown={(e) => e.preventDefault()} // prevent selection loss
          onClick={handleHighlightClick}
          className="fixed z-50 -translate-x-1/2 -translate-y-full bg-yellow-400 hover:bg-yellow-300 text-yellow-900 text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg transition-colors"
          style={{ left: selectionPopover.x, top: selectionPopover.y }}
        >
          Highlight
        </button>
      )}

      {!isPdf && <VoiceHighlighter isActive={true} onHighlight={onAddHighlight} />}
    </div>
  );
};
