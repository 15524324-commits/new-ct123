import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { QuestionRecord } from '../types';
import { Loader2, Trash2, Printer, Search, Calendar, ChevronRight, CheckCircle2, Circle, Sparkles, BookOpen, Plus, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface RecordsPageProps {
  user: User;
}

export default function RecordsPage({ user }: RecordsPageProps) {
  const [records, setRecords] = useState<QuestionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingRecord, setViewingRecord] = useState<QuestionRecord | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [includeAnswersInPdf, setIncludeAnswersInPdf] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [alertInfo, setAlertInfo] = useState<{ message: string; title?: string } | null>(null);
  const printableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'questionRecords'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => {
        const data = d.data();
        return { 
          id: d.id, 
          ...data,
          // Handle case where createdAt might be null briefly after save due to serverTimestamp()
          createdAt: data.createdAt || { toDate: () => new Date() }
        } as QuestionRecord;
      });
      setRecords(docs);
      setLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      setLoading(false);
      setAlertInfo({ 
        title: '数据加载失败', 
        message: '获取错题记录时出错了。如果是第一次使用，可能需要几秒钟建立索引。' 
      });
    });

    return unsubscribe;
  }, [user.uid]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === filteredRecords.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRecords.map(r => r.id!));
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteDoc(doc(db, 'questionRecords', deletingId));
      setDeletingId(null);
    } catch (error) {
      console.error(error);
      setAlertInfo({ title: '删除失败', message: '请检查网络连接后重试' });
    }
  };

  const handlePrint = async (shouldDownload = false) => {
    // Stage 1: Validation
    if (!printableRef.current) {
      setAlertInfo({ message: '打印模板初始化失败，请点击页面顶部的“同步”按钮或刷新重试。' });
      return;
    }
    
    if (selectedIds.length === 0) {
      setAlertInfo({ message: '【请先勾选错题】\n\n请点击下方的错题卡片（卡片变蓝代表选中），选中后再点击下载按钮。' });
      return;
    }

    setIsGeneratingPdf(true);
    console.log('PDF generation started...');

    try {
      const element = printableRef.current;
      
      // Stage 2: Force Capture Layer Visibility
      element.style.setProperty('display', 'block', 'important');
      element.style.position = 'fixed';
      element.style.left = '0';
      element.style.top = '0';
      element.style.width = '800px'; 
      element.style.visibility = 'visible';
      element.style.opacity = '1';
      element.style.zIndex = '-9999';
      element.style.background = 'white';

      // Inject temporary CSS to completely strip oklch/modern colors which break html2canvas
      const styleTag = document.createElement('style');
      styleTag.id = 'print-fix-style';
      styleTag.innerHTML = `
        #printable-container * { 
          color-scheme: light !important; 
          color: #000000 !important;
          background-color: transparent !important;
          border-color: #dddddd !important;
          box-shadow: none !important;
        }
        #printable-container .print-section {
          background-color: #ffffff !important;
          page-break-inside: avoid;
        }
        #printable-container .bg-slate-900 { background-color: #000000 !important; color: #ffffff !important; }
        #printable-container .bg-slate-50 { background-color: #f1f5f9 !important; }
        #printable-container .bg-blue-600 { background-color: #2563eb !important; color: #ffffff !important; }
        #printable-container .text-blue-600 { color: #2563eb !important; }
        #printable-container .text-slate-400 { color: #94a3b8 !important; }
      `;
      document.head.appendChild(styleTag);

      // Wait for layout rendering & images
      await new Promise(r => setTimeout(r, 1500));

      const sections = element.querySelectorAll('.print-section');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pdfWidth - (margin * 2);
      
      let currentY = margin;

      for (let i = 0; i < sections.length; i++) {
        const section = sections[i] as HTMLElement;
        section.style.margin = '0';
        section.style.padding = '0';
        
        const canvas = await html2canvas(section, {
          scale: 2, 
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          windowWidth: 800,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgHeight = (canvas.height * contentWidth) / canvas.width;

        // Force header and first question to stay on page 1
        // Only consider adding a new page from the 2nd question onwards (i > 1)
        if (i > 1 && (currentY + imgHeight) > (pdfHeight - margin)) {
          pdf.addPage();
          currentY = margin;
        }

        pdf.addImage(imgData, 'JPEG', margin, currentY, contentWidth, imgHeight);
        currentY += imgHeight + 2; 
      }
      
      // Cleanup
      document.getElementById('print-fix-style')?.remove();
      element.style.display = 'none';

      // Stage 3: Delivery
      const timestamp = new Date().getTime();
      const filename = `错题练习册_${timestamp}.pdf`;

      if (shouldDownload) {
        pdf.save(filename);
      } else {
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        setPdfPreviewUrl(url);
      }
      
      setAlertInfo({ 
        title: '生成成功', 
        message: '您的错题练习册已准备就绪。如果未自动开始下载，请检查浏览器的拦截提示。' 
      });
    } catch (error) {
      console.error('PDF creation error:', error);
      setAlertInfo({ 
        title: '生成失败', 
        message: '抱歉，渲染 PDF 时遇到了技术故障。建议您：\n1. 尝试减少勾选的题目数量\n2. 检查网络连接后重试' 
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const filteredRecords = records.filter(r => 
    r.originalText.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.knowledgePoint.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-slate-500">正在同步云端记录...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Controls */}
      <div className="card p-5 space-y-5 sticky top-24 z-20">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="在错题本中搜索关键字..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-xl text-base outline-none focus:ring-4 focus:ring-brand-primary/10 transition-all font-medium"
          />
        </div>
        
        <div className="flex justify-between items-center sm:px-2">
          <button 
            onClick={selectAll}
            className="text-sm font-bold text-slate-500 flex items-center gap-3 hover:text-brand-primary transition-colors"
          >
            {selectedIds.length === filteredRecords.length && filteredRecords.length > 0 ? (
              <CheckCircle2 className="w-5 h-5 text-brand-primary" />
            ) : (
              <Circle className="w-5 h-5 text-slate-200" />
            )}
            已选 {selectedIds.length} 项
          </button>
          
          <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
            <div className="flex items-center gap-2 mr-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
              <input 
                type="checkbox" 
                id="includeAnswers" 
                checked={includeAnswersInPdf}
                onChange={(e) => setIncludeAnswersInPdf(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="includeAnswers" className="text-xs font-bold text-slate-500 cursor-pointer">
                包含答案解析
              </label>
            </div>
            <button
              onClick={() => handlePrint(false)}
              className="btn-secondary flex-1 sm:flex-initial flex items-center justify-center gap-2 py-3 px-6"
              title="在线预览排版效果"
            >
              {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              预览
            </button>
            <button
              onClick={() => handlePrint(true)}
              className="btn-primary flex-1 sm:flex-initial flex items-center justify-center gap-2 py-3 px-6 shadow-xl shadow-indigo-100"
              title="直接生成并下载 PDF"
            >
              {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              下载 PDF
            </button>
            <button
              onClick={() => {
                const element = printableRef.current;
                if (!element) return;
                if (selectedIds.length === 0) {
                  alert('请先勾选错题卡片');
                  return;
                }
                const win = window.open('', '_blank');
                if (win) {
                  win.document.write(`
                    <html>
                      <head>
                        <title>错题打印</title>
                        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
                        <style>
                          @media print { .no-print { display: none; } }
                          body { background: white; }
                        </style>
                      </head>
                      <body class="p-8">
                        <div class="no-print bg-amber-50 p-4 mb-8 rounded-xl border border-amber-200 text-amber-800 font-bold text-center">
                          指示：请点击右键选择“打印”，并在打印对话框中选择“另存为 PDF”。
                        </div>
                        ${element.innerHTML}
                        <script>
                          setTimeout(() => { window.print(); }, 500);
                        </script>
                      </body>
                    </html>
                  `);
                  win.document.close();
                }
              }}
              className="btn-secondary hidden sm:flex items-center justify-center gap-2 py-3 px-4"
              title="使用浏览器原生打印（最可靠）"
            >
              备用打印
            </button>
          </div>
        </div>
      </div>

      {/* Helper info */}
      {selectedIds.length === 0 && records.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl text-center"
        >
          <p className="text-sm text-indigo-600 font-medium">请点击下方的错题卡片进行勾选，选择后即可生成打印文件</p>
        </motion.div>
      )}

      {/* List */}
      <div className="space-y-4">
        {filteredRecords.length === 0 ? (
          <div className="text-center py-24 card border-dashed border-2 flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
              <BookOpen className="w-8 h-8" />
            </div>
            <p className="text-slate-400 font-medium">空空如也，快去识别第一道错题吧</p>
          </div>
        ) : (
          filteredRecords.map((record) => (
            <div
              key={record.id}
              onClick={() => toggleSelect(record.id!)}
              className={`group card p-6 cursor-pointer flex items-start gap-5 transition-all ${
                selectedIds.includes(record.id!) ? 'ring-4 ring-brand-primary/10 border-brand-primary' : 'hover:border-indigo-200'
              }`}
            >
              <div className="flex-shrink-0 mt-1">
                {selectedIds.includes(record.id!) ? (
                  <CheckCircle2 className="w-6 h-6 text-brand-primary" />
                ) : (
                  <Circle className="w-6 h-6 text-slate-100 group-hover:text-indigo-100" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="tag tag-math">
                      {record.knowledgePoint}
                    </span>
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">
                      {record.createdAt?.toDate().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                    </span>
                  </div>
                  <button 
                    onClick={(e) => handleDelete(record.id!, e)}
                    className="p-2.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl transition-all shadow-sm flex items-center justify-center"
                    title="删除记录"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <h4 className="mt-4 text-base font-bold text-slate-700 line-clamp-2 leading-relaxed">
                  {record.originalText}
                </h4>
                <div className="mt-4 flex items-center gap-6">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    3 道变式推荐
                  </div>
                </div>
              </div>

              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  setViewingRecord(record);
                }}
                className="mt-1 p-3 hover:bg-slate-50 rounded-2xl transition-all text-slate-300 group-hover:text-brand-primary"
              >
                <ChevronRight className="w-6 h-6" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Record Detail Modal */}
      <AnimatePresence>
        {viewingRecord && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-2xl h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-[2.5rem] sm:rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-md z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-none mb-1">错题详情</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{viewingRecord.knowledgePoint}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setViewingRecord(null)}
                  className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-100 hover:bg-slate-200 transition-colors text-slate-500"
                >
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar scroll-smooth">
                {/* Original Question */}
                <div className="space-y-4">
                  <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest">原始错题</h5>
                  <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100">
                    {viewingRecord.originalImageUrl && (
                      <img src={viewingRecord.originalImageUrl} alt="Original" className="w-full rounded-2xl mb-4 border border-slate-200" />
                    )}
                    <div className="markdown-body">
                      <ReactMarkdown>{viewingRecord.originalText}</ReactMarkdown>
                    </div>
                  </div>
                </div>

                {/* Variants */}
                <div className="space-y-4">
                  <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest">举一反三变式练习</h5>
                  {viewingRecord.variants.map((v, i) => (
                    <div key={i} className="space-y-4 pt-4 border-t border-slate-100">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-blue-600">练习题目 {i + 1}</span>
                      </div>
                      <div className="markdown-body text-slate-700">
                        <ReactMarkdown>{v.question}</ReactMarkdown>
                      </div>
                      <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100/50 space-y-2">
                        <div>
                          <span className="text-[10px] font-bold text-amber-700 mr-2">答案:</span>
                          <span className="text-sm font-medium">{v.answer}</span>
                        </div>
                        <div className="markdown-body text-xs text-slate-500 italic">
                          <ReactMarkdown>{`解析: ${v.analysis}`}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .printable-content {
          color: black !important;
          background: white !important;
        }
        /* Anti-oklch safety net for html2canvas */
        .printable-content * {
          color: inherit !important;
          background-color: transparent !important;
          border-color: #e2e8f0 !important;
          box-shadow: none !important;
          text-shadow: none !important;
          filter: none !important;
        }
        .printable-content .bg-slate-900 { background-color: #0f172a !important; color: white !important; }
        .printable-content .bg-slate-50 { background-color: #f8fafc !important; }
        .printable-content .bg-blue-600 { background-color: #2563eb !important; color: white !important; }
        .printable-content .bg-blue-50\/30 { background-color: #f0f9ff !important; }
        .printable-content .text-blue-600 { color: #2563eb !important; }
        .printable-content .text-slate-900 { color: #0f172a !important; }
        .printable-content .text-slate-800 { color: #1e293b !important; }
        .printable-content .text-slate-400 { color: #94a3b8 !important; }
        
        @media print {
          body * { visibility: hidden; }
          .printable-content, .printable-content * { visibility: visible; }
          .printable-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          nav, button, .no-print { display: none !important; }
        }
      `}</style>
      
      {/* Printable template */}
      <div id="printable-container" ref={printableRef} style={{ display: 'none' }} className="printable-content bg-white">
        <div className="flex flex-col">
          <div className="print-section pb-4 border-b border-slate-200">
            <div className="flex justify-between text-slate-400 text-xs font-bold px-4 uppercase tracking-widest">
              <span>生成日期：{new Date().toLocaleDateString('zh-CN')}</span>
              <div className="flex gap-8">
                <span>姓名：__________</span>
                <span>班级：__________</span>
              </div>
            </div>
          </div>

          {(selectedIds.length > 0 ? filteredRecords.filter(r => selectedIds.includes(r.id!)) : records).map((record, ri) => (
            <div key={ri} className="print-section py-8 border-b border-slate-100 last:border-0 border-dashed">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <span className="bg-slate-900 text-white px-3 py-1 rounded text-xs font-bold leading-none">题目 {ri + 1}</span>
                  <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">知识点: {record.knowledgePoint}</span>
                </div>
                <div className="text-xl font-bold leading-relaxed text-slate-800 bg-slate-50 p-6 rounded-2xl">
                   <ReactMarkdown>{record.originalText}</ReactMarkdown>
                </div>
              </div>

              <div className="space-y-16 pl-4 mt-8">
                {record.variants.map((v, i) => (
                  <div key={i} className="space-y-6">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div>
                      <span className="text-sm font-black uppercase tracking-widest text-blue-600">同步巩固练习 {ri + 1}.{i + 1}</span>
                    </div>
                    <div className="text-lg leading-relaxed text-slate-800 font-medium whitespace-pre-wrap">
                      <ReactMarkdown>{v.question}</ReactMarkdown>
                    </div>
                    
                    {includeAnswersInPdf ? (
                      <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-2 mb-2">
                           <CheckCircle2 className="w-4 h-4 text-green-600" />
                           <span className="text-xs font-bold text-slate-700">答案与解析</span>
                        </div>
                        <div className="text-sm text-slate-600 space-y-2">
                          <p><span className="font-bold">答案：</span>{v.answer}</p>
                          <div className="text-xs italic"><ReactMarkdown>{v.analysis}</ReactMarkdown></div>
                        </div>
                      </div>
                    ) : (
                      /* Generous spacing for students to solve the problem */
                      <div className="h-48 border-2 border-dashed border-slate-100 rounded-3xl flex items-center justify-center text-slate-300 font-bold italic bg-slate-50/30">
                        答题区域
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PDF Preview Modal */}
      <AnimatePresence>
        {pdfPreviewUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="bg-white w-full max-w-5xl h-[90vh] rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl border-4 border-white"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center">
                    <Printer className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">打印预览</h3>
                    <p className="text-xs text-slate-400">请检查排版后进行打印或下载</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                        window.open(pdfPreviewUrl, '_blank');
                    }}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <BookOpen className="w-4 h-4" /> 新窗口打开
                  </button>
                  <button
                    onClick={() => {
                        const link = document.createElement('a');
                        link.href = pdfPreviewUrl;
                        link.download = `错题练习册_${new Date().getTime()}.pdf`;
                        link.click();
                    }}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" /> 下载文件
                  </button>
                  <button 
                    onClick={() => {
                        URL.revokeObjectURL(pdfPreviewUrl);
                        setPdfPreviewUrl(null);
                    }}
                    className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-colors text-slate-500"
                  >
                    <Plus className="w-5 h-5 rotate-45" />
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-slate-800">
                <iframe src={pdfPreviewUrl} className="w-full h-full border-none" title="PDF Preview" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Processing Loader Overlay */}
      <AnimatePresence>
        {isGeneratingPdf && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-md text-white px-10 text-center"
          >
            <div className="w-24 h-24 bg-blue-600 rounded-[2rem] flex items-center justify-center shadow-2xl mb-8 border-4 border-blue-400">
              <Loader2 className="w-12 h-12 animate-spin text-white" />
            </div>
            <h3 className="text-3xl font-black mb-4 tracking-tight">正在生成 A4 练习册...</h3>
            <p className="text-slate-300 font-bold mb-8 max-w-sm leading-relaxed">请耐心等待约 2-5 秒，我们正在为您排版题目并转为 PDF 文件。</p>
            <div className="flex items-center gap-2 bg-white/10 px-6 py-3 rounded-2xl border border-white/10">
               <Sparkles className="w-5 h-5 text-indigo-400" />
               <span className="text-sm font-bold tracking-widest uppercase">完成后将自动弹出保存提示</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-8 rounded-[2rem] max-w-sm w-full shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-500">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">确定删除吗？</h3>
              <p className="text-slate-500 mb-8 leading-relaxed">删除后该错题记录及其变式将无法恢复。</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setDeletingId(null)}
                  className="py-3 px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-all"
                >
                  取消
                </button>
                <button
                  onClick={confirmDelete}
                  className="py-3 px-6 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-red-100"
                >
                  确认删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Alert Modal */}
      <AnimatePresence>
        {alertInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-8 rounded-[2rem] max-w-sm w-full shadow-2xl text-center"
            >
              <h3 className="text-xl font-bold mb-4">{alertInfo.title || '温馨提示'}</h3>
              <p className="text-slate-500 mb-8 whitespace-pre-wrap leading-relaxed">{alertInfo.message}</p>
              <button
                onClick={() => setAlertInfo(null)}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-100"
              >
                我知道了
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
