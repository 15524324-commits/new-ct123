import React, { useState, useRef } from 'react';
import { User } from 'firebase/auth';
import { Camera, Image as ImageIcon, Loader2, Sparkles, Save, RotateCcw, Edit2, Check, Plus } from 'lucide-react';
import { recognizeQuestion, generateVariants } from '../services/aiService';
import { VariantQuestion, QuestionRecord } from '../types';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import { motion } from 'motion/react';

interface RecognitionPageProps {
  user: User;
  onSaved?: () => void;
}

export default function RecognitionPage({ user, onSaved }: RecognitionPageProps) {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'upload' | 'recognize' | 'variants'>('upload');
  const [ocrText, setOcrText] = useState('');
  const [kp, setKp] = useState('');
  const [variants, setVariants] = useState<VariantQuestion[]>([]);
  const [isEditingOcr, setIsEditingOcr] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastGeneratedText, setLastGeneratedText] = useState(''); // Track what was used for generation

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        handleStartRecognition(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStartRecognition = async (img: string) => {
    setLoading(true);
    setStep('recognize');
    try {
      const result = await recognizeQuestion(img);
      setOcrText(result.text);
      setKp(result.knowledgePoint);
    } catch (error) {
      console.error(error);
      alert('识别失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateVariants = async () => {
    setLoading(true);
    try {
      const result = await generateVariants(ocrText, kp);
      setVariants(result);
      setLastGeneratedText(ocrText); // Save the text used for this generation
      setStep('variants');
    } catch (error) {
      console.error(error);
      alert('生成变式失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const record: Omit<QuestionRecord, 'id'> = {
        userId: user.uid,
        originalImageUrl: image || undefined,
        // Use the text that corresponds to the generated variants to ensure consistency
        originalText: lastGeneratedText || ocrText,
        knowledgePoint: kp || '未分类',
        variants: variants,
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, 'questionRecords'), record);
      setSaveStatus('saved');
      
      // Give feedback then redirect
      setTimeout(() => {
        if (onSaved) onSaved();
      }, 800);
    } catch (error) {
      console.error(error);
      alert('保存失败，请检查网络后重试');
      setSaveStatus('idle');
    }
  };

  const reset = () => {
    setImage(null);
    setOcrText('');
    setKp('');
    setVariants([]);
    setLastGeneratedText('');
    setStep('upload');
    setSaveStatus('idle');
  };

  if (step === 'upload') {
    return (
      <div className="space-y-10 py-10">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-bold tracking-tight text-slate-800">开始识别错题</h2>
          <p className="text-slate-500 text-lg">拍照或从相册选择一张包含错题的图片，AI 将为您深度解析</p>
        </div>

        <div className="max-w-xl mx-auto">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex flex-col items-center justify-center p-20 border-2 border-dashed border-brand-border rounded-[2.5rem] bg-white hover:border-brand-primary hover:bg-indigo-50 transition-all group shadow-xl shadow-slate-200/50"
          >
            <div className="w-20 h-20 bg-brand-primary/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
              <Camera className="w-10 h-10 text-brand-primary" />
            </div>
            <span className="text-xl font-bold text-slate-700">拍照 / 上传错题图片</span>
            <span className="text-sm text-slate-400 mt-2">支持数学公式、中英文题干识别</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-12 items-start">
      {/* OCR/Edit Step */}
      <div className="card flex flex-col h-fit">
        <div className="p-5 border-b border-brand-border bg-slate-50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Edit2 className="w-4 h-4 text-brand-primary" />
            <span className="text-sm font-bold text-slate-600 uppercase tracking-widest">原错题识别内容</span>
          </div>
          {kp && <span className="tag tag-math">{kp}</span>}
        </div>

        <div className="p-6">
          {loading && step === 'recognize' ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-brand-primary" />
              <p className="text-sm font-medium text-slate-500">AI 正在精准识别物理字符...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 text-slate-600 italic text-sm">
                OCR 已自动识别数学公式与文字，请检查并校对内容。
              </div>

              {isEditingOcr ? (
                <div className="space-y-4">
                  <textarea
                    value={ocrText}
                    onChange={(e) => setOcrText(e.target.value)}
                    className="w-full h-48 p-5 border border-brand-border rounded-xl text-base focus:ring-4 focus:ring-brand-primary/10 transition-all outline-none resize-none"
                    placeholder="请输入题目内容..."
                  />
                  <div className="flex gap-2">
                    <input
                      value={kp}
                      onChange={(e) => setKp(e.target.value)}
                      className="flex-1 p-4 border border-brand-border rounded-xl text-sm focus:ring-4 focus:ring-brand-primary/10 transition-all outline-none"
                      placeholder="设置知识点 (如: 三角函数)..."
                    />
                    <button 
                      onClick={() => setIsEditingOcr(false)}
                      className="btn-primary flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" /> 确定
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="markdown-body p-2 leading-relaxed text-lg min-h-[140px]">
                    <ReactMarkdown>{ocrText}</ReactMarkdown>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                    <button 
                      onClick={() => setIsEditingOcr(true)}
                      className="text-brand-primary text-sm font-bold flex items-center gap-1 hover:underline"
                    >
                      <Edit2 className="w-3 h-3" /> 修改题目内容
                    </button>
                  </div>
                </div>
              )}

              {step === 'recognize' && (
                <button
                  onClick={handleGenerateVariants}
                  disabled={loading}
                  className="w-full btn-primary py-5 text-lg flex items-center justify-center gap-3 shadow-xl shadow-indigo-100"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                  AI 智能生成 3 道举一反三题
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Variants Step */}
      <div className="space-y-6">
        {step === 'variants' && (
          <>
            <div className="card p-6 overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  举一反三推荐题目
                </h3>
                <button 
                  onClick={handleGenerateVariants}
                  className="text-slate-400 text-sm font-medium hover:text-brand-primary transition-colors flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> 重新生成
                </button>
              </div>
              
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <Loader2 className="w-10 h-10 animate-spin text-brand-primary" />
                  <p className="text-sm font-medium text-slate-500">正在构思高质量变式题...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {variants.map((v, i) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      key={i} 
                      className="problem-box"
                    >
                      <div className="markdown-body font-medium text-slate-800 mb-3">
                        <span className="font-bold mr-2 text-brand-primary">{i + 1}.</span>
                        <ReactMarkdown>{v.question}</ReactMarkdown>
                      </div>
                      <div className="analysis-box">
                        <div className="font-bold mb-1 flex items-center gap-1">
                          <RotateCcw className="w-3 h-3" /> 易错点分析：
                        </div>
                        <ReactMarkdown>{v.analysis}</ReactMarkdown>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleSave}
                disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                className="flex-[2] btn-primary py-4 flex items-center justify-center gap-2 shadow-xl shadow-indigo-100"
              >
                {saveStatus === 'saving' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {saveStatus === 'saved' ? '已收录' : '保存及收录'}
              </button>
              <button
                onClick={reset}
                className="flex-1 btn-secondary py-4"
              >
                重新开始
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
