import React, { useState, useEffect } from 'react';
import { Save, Loader2, FileCode, Check, X } from 'lucide-react';

interface EditorTabProps {
  filePath: string;
  onLog: (message: string, level: 'info' | 'warn' | 'error' | 'success') => void;
  onClose: () => void;
}

const EditorTab: React.FC<EditorTabProps> = ({ filePath, onLog, onClose }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/workspace/file?path=${encodeURIComponent(filePath)}`);
        if (res.ok) {
          const text = await res.text();
          setContent(text);
          setHasChanges(false);
        } else {
          onLog(`Failed to load file: ${filePath}`, 'error');
        }
      } catch (e) {
        onLog(`Editor Error: ${e}`, 'error');
      } finally {
        setLoading(false);
      }
    };

    if (filePath) fetchContent();
  }, [filePath]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/workspace/file?path=${encodeURIComponent(filePath)}`, {
        method: 'POST',
        body: content
      });
      if (res.ok) {
        onLog(`Saved ${filePath}`, 'success');
        setHasChanges(false);
      } else {
        onLog('Failed to save file', 'error');
      }
    } catch (e) {
      onLog('Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900 text-slate-400">
        <Loader2 className="animate-spin mr-2" size={20} />
        Loading {filePath}...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 font-mono overflow-hidden">
      <div className="h-9 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
           <FileCode size={14} className="text-blue-400" />
           <span className="text-xs text-slate-300 truncate max-w-md">{filePath}</span>
           {hasChanges && <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
        </div>
        <div className="flex items-center gap-2">
           <button 
             onClick={handleSave}
             disabled={!hasChanges || saving}
             className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold transition-colors ${
               hasChanges ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-800 text-slate-500'
             }`}
           >
             {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
             SAVE
           </button>
           <button 
             onClick={onClose}
             className="p-1 hover:bg-slate-800 text-slate-500 hover:text-white rounded"
           >
             <X size={14} />
           </button>
        </div>
      </div>
      <div className="flex-1 relative">
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setHasChanges(true);
          }}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          className="absolute inset-0 w-full h-full bg-transparent text-slate-300 p-4 resize-none outline-none text-sm leading-relaxed"
          placeholder="File is empty..."
        />
      </div>
    </div>
  );
};

export default EditorTab;