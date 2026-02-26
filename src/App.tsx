import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Library, Download, Settings, Search, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Bookmark, Highlight } from './types';
import { api } from './services/api';
import { saveBookmarkOffline, getOfflineBookmarks, deleteBookmarkOffline, saveHighlightOffline, getHighlightsOffline } from './services/db';
import { BookmarkCard } from './components/BookmarkCard';
import { Reader } from './components/Reader';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [offlineBookmarks, setOfflineBookmarks] = useState<Bookmark[]>([]);
  const [activeBookmark, setActiveBookmark] = useState<Bookmark | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [view, setView] = useState<'library' | 'offline'>('library');
  const [syncPeers, setSyncPeers] = useState<{ id: string; name: string; lastSynced: number }[]>([]);

  const fetchData = useCallback(async () => {
    try {
      if (isOnline) {
        const data = await api.getBookmarks();
        setBookmarks(data);
      }
      const offlineData = await getOfflineBookmarks();
      setOfflineBookmarks(offlineData);
    } catch (error) {
      console.error('Failed to fetch bookmarks:', error);
    }
  }, [isOnline]);

  useEffect(() => {
    fetchData();
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchData]);

  useEffect(() => {
    const pollSync = async () => {
      try {
        const { peers } = await api.getSyncStatus();
        setSyncPeers(peers);
      } catch {
        // ignore — server may not be reachable
      }
    };
    pollSync();
    const interval = setInterval(pollSync, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAddBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) return;
    setIsLoading(true);
    try {
      const { html } = await api.fetchContent(newUrl);
      const newBookmark: Bookmark = {
        id: crypto.randomUUID(),
        url: newUrl,
        title: newUrl.split('/').pop() || 'New Article',
        content: html,
        category: 'to read',
        status: 'unread',
        progress: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await api.saveBookmark(newBookmark);
      setBookmarks(prev => [newBookmark, ...prev]);
      setNewUrl('');
      setIsAdding(false);
    } catch (error) {
      alert('Failed to add bookmark. Make sure the URL is valid.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (bookmark: Bookmark) => {
    try {
      await saveBookmarkOffline(bookmark);
      const offlineData = await getOfflineBookmarks();
      setOfflineBookmarks(offlineData);
    } catch (error) {
      alert('Failed to download for offline reading.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this?')) return;
    try {
      if (isOnline) await api.deleteBookmark(id);
      await deleteBookmarkOffline(id);
      setBookmarks(prev => prev.filter(b => b.id !== id));
      setOfflineBookmarks(prev => prev.filter(b => b.id !== id));
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleRead = async (bookmark: Bookmark) => {
    setActiveBookmark(bookmark);
    try {
      let h: Highlight[] = [];
      if (isOnline && !bookmark.isOffline) {
        h = await api.getHighlights(bookmark.id);
      } else {
        h = await getHighlightsOffline(bookmark.id);
      }
      setHighlights(h);
    } catch (error) {
      console.error('Failed to fetch highlights:', error);
    }
  };

  const handleAddHighlight = async (text: string) => {
    if (!activeBookmark) return;
    const newHighlight: Highlight = {
      id: crypto.randomUUID(),
      bookmark_id: activeBookmark.id,
      text,
      color: 'yellow',
      created_at: new Date().toISOString(),
    };
    
    try {
      if (isOnline) await api.saveHighlight(newHighlight);
      await saveHighlightOffline(newHighlight);
      setHighlights(prev => [...prev, newHighlight]);
    } catch (error) {
      console.error('Failed to save highlight:', error);
    }
  };

  const displayedBookmarks = view === 'library' ? bookmarks : offlineBookmarks;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-stone-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-stone-900 rounded-lg flex items-center justify-center text-white font-serif italic text-xl">V</div>
            <h1 className="text-xl font-serif font-bold tracking-tight">VoxRead</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
            }`}>
              {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
              {isOnline ? 'Online' : 'Offline'}
            </div>
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              syncPeers.length > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-stone-100 text-stone-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${syncPeers.length > 0 ? 'bg-emerald-500' : 'bg-stone-300'}`} />
              {syncPeers.length} {syncPeers.length === 1 ? 'peer' : 'peers'} synced
            </div>
            <button 
              onClick={() => setIsAdding(true)}
              className="p-2 bg-stone-900 text-white rounded-full hover:bg-stone-800 transition-colors"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8 pb-24">
        {/* View Switcher */}
        <div className="flex gap-4 mb-8 border-b border-stone-200">
          <button 
            onClick={() => setView('library')}
            className={`pb-2 px-1 text-sm font-medium transition-colors relative ${
              view === 'library' ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            Library
            {view === 'library' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-stone-900" />}
          </button>
          <button 
            onClick={() => setView('offline')}
            className={`pb-2 px-1 text-sm font-medium transition-colors relative ${
              view === 'offline' ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            Offline
            {view === 'offline' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-stone-900" />}
          </button>
        </div>

        {/* Search & Filter */}
        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input 
            type="text" 
            placeholder="Search your library..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-200 transition-all"
          />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {displayedBookmarks.map((bookmark) => (
              <motion.div
                key={bookmark.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                layout
              >
                <BookmarkCard 
                  bookmark={bookmark} 
                  onRead={handleRead}
                  onDelete={handleDelete}
                  onDownload={handleDownload}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {displayedBookmarks.length === 0 && (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-stone-100 rounded-full text-stone-400 mb-4">
              <Library size={32} />
            </div>
            <h3 className="text-lg font-medium text-stone-600">No bookmarks found</h3>
            <p className="text-stone-400 text-sm">Start by adding a link to your library.</p>
          </div>
        )}
      </main>

      {/* Add Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6"
            >
              <h2 className="text-xl font-serif font-bold mb-4">Add New Link</h2>
              <form onSubmit={handleAddBookmark}>
                <input 
                  autoFocus
                  type="url" 
                  placeholder="https://substack.com/post/..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-stone-200"
                  required
                />
                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 py-3 border border-stone-200 rounded-xl font-medium hover:bg-stone-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading ? <RefreshCw className="animate-spin" size={18} /> : 'Add Link'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reader Overlay */}
      <AnimatePresence>
        {activeBookmark && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-40"
          >
            <Reader 
              bookmark={activeBookmark} 
              highlights={highlights}
              onAddHighlight={handleAddHighlight}
              onClose={() => setActiveBookmark(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Nav (Mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-stone-200 px-6 py-3 flex justify-around items-center z-30">
        <button onClick={() => setView('library')} className={`flex flex-col items-center gap-1 ${view === 'library' ? 'text-stone-900' : 'text-stone-400'}`}>
          <Library size={20} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Library</span>
        </button>
        <button onClick={() => setView('offline')} className={`flex flex-col items-center gap-1 ${view === 'offline' ? 'text-stone-900' : 'text-stone-400'}`}>
          <Download size={20} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Offline</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-stone-400">
          <Settings size={20} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Settings</span>
        </button>
      </nav>
    </div>
  );
}
