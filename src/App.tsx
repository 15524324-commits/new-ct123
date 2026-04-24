import React, { useState, useEffect } from 'react';
import { User, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';
import { BookOpen, Loader2, Plus, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import RecognitionPage from './components/RecognitionPage';
import RecordsPage from './components/RecordsPage';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'scan' | 'book'>('scan');

  useEffect(() => {
    // Automatically sign in anonymously if no user exists
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        setLoading(false);
      } else {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Anonymous auth failed:", error);
          // Use a semi-persistent ID from localStorage or fallback
          const localId = localStorage.getItem('app_local_id') || `user_${Math.random().toString(36).substr(2, 9)}`;
          localStorage.setItem('app_local_id', localId);
          setUser({ uid: localId, isAnonymous: true } as any);
          setLoading(false);
        }
      }
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg pb-24">
      {/* Header */}
      <header className="h-[80px] bg-white border-b border-brand-border sticky top-0 z-30 px-6 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h1 className="font-bold text-xl text-slate-800 tracking-tight">
            错题举一反三打印机
          </h1>
        </div>

        <nav className="sm:flex space-x-1 bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('scan')}
            className={`px-6 py-2 rounded-lg font-bold transition-all ${
              activeTab === 'scan' ? 'bg-white shadow-sm text-brand-primary' : 'text-slate-500 font-medium hover:text-slate-700'
            }`}
          >
            错题识别
          </button>
          <button 
            onClick={() => setActiveTab('book')}
            className={`px-6 py-2 rounded-lg font-bold transition-all ${
              activeTab === 'book' ? 'bg-white shadow-sm text-brand-primary' : 'text-slate-500 font-medium hover:text-slate-700'
            }`}
          >
            历史错题本
          </button>
        </nav>

        <div className="w-10 h-10" /> {/* Spacer for balance */}
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'scan' ? (
            <motion.div
              key="scan"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <RecognitionPage user={user} onSaved={() => setActiveTab('book')} />
            </motion.div>
          ) : (
            <motion.div
              key="book"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <RecordsPage user={user} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
