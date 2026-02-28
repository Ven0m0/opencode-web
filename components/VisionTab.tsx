import React, { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, FileText, Send, X, Loader2, History, Clock } from 'lucide-react';
import { analyzeImage } from '../services/geminiService';

interface VisionTabProps {
  onLog: (message: string, level: 'info' | 'warn' | 'error' | 'success') => void;
}

const VisionTab: React.FC<VisionTabProps> = ({ onLog }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // History State
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('vision_prompt_history');
    if (saved) {
      setPromptHistory(JSON.parse(saved));
    }
  }, []);

  const saveToHistory = (text: string) => {
     if (!text.trim()) return;
     setPromptHistory(prev => {
       const newHistory = [text, ...prev.filter(p => p !== text)].slice(0, 10);
       localStorage.setItem('vision_prompt_history', JSON.stringify(newHistory));
       return newHistory;
     });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type.startsWith('image/')) {
        setSelectedFile(file);
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        setResult(null);
        onLog(`Image loaded: ${file.name}`, 'info');
      } else {
        onLog('Invalid file type selected. Please select an image.', 'warn');
      }
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAnalyze = async () => {
    if (!selectedFile || isLoading) return;

    setIsLoading(true);
    setResult(null);
    saveToHistory(prompt || "Analyze this image in detail.");
    setShowHistory(false);
    onLog(`Analyzing image '${selectedFile.name}' with Gemini 3 Pro...`, 'info');

    try {
      const analysis = await analyzeImage(selectedFile, prompt);
      setResult(analysis);
      onLog('Image analysis complete.', 'success');
    } catch (error) {
      onLog(`Analysis failed: ${error}`, 'error');
      setResult("Error: Could not analyze the image. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-y-auto">
      {/* Header */}
      <div className="h-12 border-b border-slate-700 flex items-center px-6 bg-slate-800/50 shrink-0">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <ImageIcon size={18} className="text-purple-400" />
          VISION ANALYZER
        </h2>
      </div>

      <div className="flex-1 p-6 max-w-5xl mx-auto w-full flex flex-col gap-6">
        
        {/* Upload Area */}
        <div className={`
            relative border-2 border-dashed rounded-lg transition-colors p-8 flex flex-col items-center justify-center gap-4
            ${selectedFile ? 'border-purple-500/50 bg-purple-900/10' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/50'}
          `}>
            
            {previewUrl ? (
              <div className="relative max-h-[400px] flex items-center justify-center">
                <img src={previewUrl} alt="Preview" className="max-h-[400px] rounded shadow-lg object-contain" />
                <button 
                  onClick={handleClearFile}
                  className="absolute -top-3 -right-3 p-1 bg-red-500 hover:bg-red-600 rounded-full text-white shadow-md transition-colors z-10"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <div className="p-4 rounded-full bg-slate-800">
                  <Upload size={32} className="text-slate-400" />
                </div>
                <div className="text-center">
                  <p className="text-slate-300 font-medium">Click to upload an image</p>
                  <p className="text-slate-500 text-sm mt-1">Supports JPG, PNG, WEBP</p>
                </div>
              </>
            )}
            
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*"
              onChange={handleFileSelect}
              className={`absolute inset-0 w-full h-full opacity-0 cursor-pointer ${selectedFile ? 'hidden' : ''}`}
            />
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3 relative">
           <label className="text-sm text-slate-400 font-medium">Instruction (Optional)</label>
           <div className="flex gap-2 relative">
             <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-400 hover:text-white rounded flex items-center gap-2"
                title="Select Image from System"
             >
                <Upload size={18} />
                <span className="hidden sm:inline text-xs font-medium">Upload</span>
             </button>
             <input
               type="text"
               value={prompt}
               onChange={(e) => setPrompt(e.target.value)}
               placeholder="E.g., Describe the UI layout, Identify the code snippet, etc."
               className="flex-1 bg-slate-800 border border-slate-700 rounded px-4 py-2 text-slate-200 focus:outline-none focus:border-purple-500"
             />
             <button
               onClick={() => setShowHistory(!showHistory)}
               className="px-3 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-400 hover:text-white rounded"
               title="History"
             >
                <History size={18} />
             </button>
             <button
                onClick={handleAnalyze}
                disabled={!selectedFile || isLoading}
                className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
             >
               {isLoading ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
               Analyze
             </button>
           </div>
           
           {/* History Popup */}
           {showHistory && (
             <div className="absolute top-full left-0 mt-2 w-full max-w-lg bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10 overflow-hidden">
                <div className="p-2 border-b border-slate-700 text-xs font-semibold text-slate-400 flex items-center gap-2">
                   <Clock size={12} /> Recent Vision Prompts
                </div>
                <div className="max-h-40 overflow-y-auto">
                   {promptHistory.map((h, i) => (
                      <button key={i} onClick={() => { setPrompt(h); setShowHistory(false); }} className="w-full text-left p-2 text-xs text-slate-300 hover:bg-slate-700 truncate border-b border-slate-700/50 last:border-0">
                         {h}
                      </button>
                   ))}
                </div>
             </div>
           )}
        </div>

        {/* Result */}
        {result && (
          <div className="mt-4 border border-slate-700 rounded-lg overflow-hidden bg-slate-800/30">
            <div className="bg-slate-800 px-4 py-2 text-xs font-mono text-slate-400 border-b border-slate-700 flex justify-between items-center">
              <span>OUTPUT</span>
              <span className="text-purple-400">gemini-3-pro-preview</span>
            </div>
            <div className="p-6 text-slate-200 text-sm leading-relaxed whitespace-pre-wrap font-mono">
              {result}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisionTab;