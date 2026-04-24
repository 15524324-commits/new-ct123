import React, { useState, useEffect } from 'react';
import { auth, signIn, signOut } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { BookOpen, LogOut, Loader2, Plus, Sparkles, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import RecognitionPage from './components/RecognitionPage';
import RecordsPage from './components/RecordsPage';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'scan' | 'book'>('scan');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
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

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-bg p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border border-brand-border"
        >
          <div className="w-24 h-24 bg-brand-primary rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-indigo-200">
            <Sparkles className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-black mb-3 tracking-tighter text-slate-800">错题举一反三打印机</h1>
          <p className="text-slate-400 mb-10 leading-relaxed font-medium">
            拍照识别错题，AI 智能生成变式练习题。<br/>打造您的专属个性化提分手册。
          </p>
          <button
            onClick={signIn}
            className="w-full bg-slate-900 text-white font-bold py-5 px-6 rounded-2xl hover:bg-slate-800 transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95"
          >
            <UserIcon className="w-5 h-5 text-indigo-400" />
            使用 Google 账号开始
          </button>
          
          <div className="mt-8 pt-8 border-t border-slate-50 text-[10px] uppercase tracking-widest text-slate-300 font-bold">
            Empowered by Gemini 3 Flash
          </div>
        </motion.div>
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

        <nav className="hidden sm:flex space-x-1 bg-slate-100 p-1 rounded-xl">
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

        <button 
          onClick={signOut}
          className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
          title="退出登录"
        >
          <LogOut className="w-5 h-5" />
        </button>
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
