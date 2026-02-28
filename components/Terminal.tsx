import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';
import { Terminal as TerminalIcon, XCircle, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface TerminalProps {
  logs: LogEntry[];
  isOpen: boolean;
  onToggle: () => void;
}

const Terminal: React.FC<TerminalProps> = ({ logs, isOpen, onToggle }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  const getIcon = (level: string) => {
    switch (level) {
      case 'error': return <XCircle size={14} className="text-red-500" />;
      case 'success': return <CheckCircle size={14} className="text-green-500" />;
      case 'warn': return <AlertCircle size={14} className="text-yellow-500" />;
      default: return <Info size={14} className="text-blue-500" />;
    }
  };

  const getColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'success': return 'text-green-400';
      case 'warn': return 'text-yellow-400';
      default: return 'text-blue-300';
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={onToggle}
        className="h-6 w-full bg-slate-800 border-t border-slate-700 flex items-center px-4 text-xs text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
      >
        <TerminalIcon size={12} className="mr-2" />
        <span className="mr-2">TERMINAL</span>
        <span className="bg-slate-700 px-1 rounded text-[10px]">{logs.length} events</span>
      </button>
    );
  }

  return (
    <div className="h-48 bg-slate-950 border-t border-slate-700 flex flex-col font-mono text-sm">
      <div className="h-8 bg-slate-800 flex items-center px-4 justify-between select-none">
        <div className="flex items-center gap-2">
           <TerminalIcon size={14} className="text-slate-400" />
           <span className="text-xs font-bold text-slate-300">TERMINAL</span>
        </div>
        <button onClick={onToggle} className="text-slate-400 hover:text-white">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2 space-y-1"
      >
        {logs.length === 0 && (
          <div className="text-slate-500 italic px-2">System initialized. Waiting for events...</div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="flex items-start gap-2 hover:bg-slate-900 p-0.5 rounded">
            <span className="text-slate-500 text-xs mt-0.5 min-w-[70px]">
              {log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
            </span>
            <span className="mt-1">{getIcon(log.level)}</span>
            <span className={`break-all ${getColor(log.level)}`}>{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Terminal;
