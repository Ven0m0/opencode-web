import React, { useState, useEffect } from 'react';
import { Folder, File, ChevronRight, ChevronDown, RefreshCcw, FolderPlus, FilePlus } from 'lucide-react';
import { WorkspaceFile } from '../types';

interface FileExplorerProps {
  onFileSelect: (path: string) => void;
  onLog: (message: string, level: 'info' | 'warn' | 'error' | 'success') => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({ onFileSelect, onLog }) => {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/workspace');
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
      }
    } catch (e) {
      onLog('Failed to fetch workspace files', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const toggleExpand = (path: string) => {
    setExpanded(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const renderEntry = (entry: WorkspaceFile, depth = 0) => {
    const isExpanded = expanded[entry.path];
    const isDir = entry.isDirectory;

    return (
      <div key={entry.path} className="flex flex-col">
        <div 
          onClick={() => isDir ? toggleExpand(entry.path) : onFileSelect(entry.path)}
          className={`
            flex items-center gap-2 py-1 px-2 cursor-pointer hover:bg-slate-800 transition-colors group text-sm
            ${depth > 0 ? `ml-${depth * 2}` : ''}
          `}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <span className="text-slate-500">
            {isDir ? (
              isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
            ) : null}
          </span>
          <span className={`${isDir ? 'text-blue-400' : 'text-slate-300'} shrink-0`}>
            {isDir ? <Folder size={14} fill="currentColor" fillOpacity={0.2} /> : <File size={14} />}
          </span>
          <span className="truncate group-hover:text-white">{entry.name}</span>
        </div>
        
        {isDir && isExpanded && entry.children && (
          <div className="flex flex-col">
            {entry.children.map(child => renderEntry(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 w-64 select-none">
      <div className="h-9 border-b border-slate-800 flex items-center justify-between px-3 bg-slate-950/50">
        <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">EXPLORER</span>
        <div className="flex items-center gap-2">
           <button onClick={fetchFiles} className="text-slate-500 hover:text-slate-200" title="Refresh">
             <RefreshCcw size={12} className={loading ? 'animate-spin' : ''} />
           </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pt-2 custom-scrollbar">
        {files.length === 0 && !loading && (
          <div className="p-4 text-center text-xs text-slate-600 italic">Workspace is empty</div>
        )}
        {files.map(file => renderEntry(file))}
      </div>
    </div>
  );
};

export default FileExplorer;