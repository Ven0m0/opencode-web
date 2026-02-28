import React, { useState, useEffect } from 'react';
import { Activity, Server, Cpu, HardDrive, Package, Search, File, Folder, Clock, FileText, AlignLeft, GitBranch, GitCommit, UploadCloud, RefreshCw, PlusCircle, Terminal } from 'lucide-react';

interface FileResult {
  name: string;
  path: string;
  size: number;
  modified: string;
  matchType?: 'filename' | 'content';
}

interface DashboardTabProps {
  onLog: (message: string, level: 'info' | 'warn' | 'error' | 'success') => void;
}

const DashboardTab: React.FC<DashboardTabProps> = ({ onLog }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FileResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Git State
  const [commitMessage, setCommitMessage] = useState('');
  const [isGitLoading, setIsGitLoading] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length > 1) {
        setIsSearching(true);
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
          if (res.ok) {
            const data = await res.json();
            setSearchResults(data);
          }
        } catch (e) {
          console.error("Search failed", e);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const executeGitCommand = async (command: string, args: string[] = []) => {
    setIsGitLoading(true);
    onLog(`> git ${command} ${args.join(' ')}`, 'info');
    
    try {
        const res = await fetch('/api/git', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command, args })
        });
        
        const data = await res.json();
        
        if (data.stdout) {
             // Split lines for cleaner log output
             data.stdout.split('\n').filter(Boolean).forEach((line: string) => onLog(line, 'success'));
        }
        if (data.stderr) {
             onLog(data.stderr, 'warn');
        }
        if (data.error) {
             onLog(`Git Error: ${data.error}`, 'error');
        }
        
    } catch (e) {
        onLog(`Failed to execute git command: ${e}`, 'error');
    } finally {
        setIsGitLoading(false);
    }
  };

  const handleCommit = () => {
      if (!commitMessage.trim()) {
          onLog('Please enter a commit message.', 'warn');
          return;
      }
      executeGitCommand('commit', ['-m', commitMessage]);
      setCommitMessage('');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-y-auto p-8">
      <h1 className="text-2xl font-bold text-slate-100 mb-8">System Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Server Status Card */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Server size={64} />
          </div>
          <div className="flex items-center gap-3 mb-4">
             <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
             <h3 className="text-slate-400 font-medium text-sm">SERVICE STATUS</h3>
          </div>
          <div className="text-2xl font-mono text-slate-100 mb-1">Active (Background)</div>
          <div className="text-xs text-slate-500 font-mono">Uptime: 14h 32m 12s</div>
        </div>

        {/* Runtime Card */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Cpu size={64} />
          </div>
          <div className="flex items-center gap-3 mb-4">
             <Activity size={16} className="text-purple-400" />
             <h3 className="text-slate-400 font-medium text-sm">RUNTIME ENV</h3>
          </div>
          <div className="text-2xl font-mono text-slate-100 mb-1">Bun v1.1.26</div>
          <div className="text-xs text-slate-500 font-mono">Memory Usage: 42MB</div>
        </div>

        {/* Git Control Card */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 relative overflow-hidden flex flex-col justify-between">
           <div>
              <div className="flex items-center gap-3 mb-4">
                 <GitBranch size={16} className="text-orange-400" />
                 <h3 className="text-slate-400 font-medium text-sm">VERSION CONTROL</h3>
              </div>
              <div className="flex gap-2 mb-3">
                 <button 
                   onClick={() => executeGitCommand('status')}
                   disabled={isGitLoading}
                   className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
                 >
                    <Terminal size={12} /> Status
                 </button>
                 <button 
                   onClick={() => executeGitCommand('add', ['.'])}
                   disabled={isGitLoading}
                   className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
                 >
                    <PlusCircle size={12} /> Add All
                 </button>
              </div>
              <div className="flex gap-2">
                 <input 
                   type="text" 
                   value={commitMessage}
                   onChange={(e) => setCommitMessage(e.target.value)}
                   placeholder="Commit message..."
                   className="flex-[2] bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 focus:border-orange-500 outline-none"
                   onKeyDown={(e) => e.key === 'Enter' && handleCommit()}
                 />
                 <button 
                   onClick={handleCommit}
                   disabled={isGitLoading || !commitMessage}
                   className="flex-1 bg-orange-600 hover:bg-orange-500 text-white text-xs py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
                 >
                    <GitCommit size={12} />
                 </button>
              </div>
           </div>
           <button 
              onClick={() => executeGitCommand('push')}
              disabled={isGitLoading}
              className="mt-3 w-full bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
           >
              <UploadCloud size={12} /> Push to Origin
           </button>
        </div>
      </div>

      {/* Workspace Search Section */}
      <div className="mb-8">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
           <h3 className="text-slate-200 font-semibold mb-4 flex items-center gap-2">
             <Search size={18} className="text-blue-400" />
             Workspace Index Search
           </h3>
           <div className="relative mb-4">
             <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search filenames or contents..." 
                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
             />
             <Search size={18} className="absolute left-3 top-3.5 text-slate-500" />
             {isSearching && (
                <div className="absolute right-3 top-3.5 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
             )}
           </div>

           {searchQuery.length > 1 && (
             <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                {searchResults.length === 0 && !isSearching ? (
                   <div className="text-center text-slate-500 py-4 text-sm">No files found matching "{searchQuery}"</div>
                ) : (
                   searchResults.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-900/50 rounded border border-slate-700/50 hover:bg-slate-900 transition-colors cursor-pointer group">
                         <div className="flex items-center gap-3 overflow-hidden">
                            <File size={16} className="text-slate-400 group-hover:text-blue-400 shrink-0" />
                            <div className="min-w-0">
                               <div className="text-sm text-slate-200 font-mono flex items-center gap-2">
                                 <span className="truncate">{file.name}</span>
                                 {file.matchType === 'content' && (
                                   <span className="text-[9px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                                     <AlignLeft size={8} /> Content Match
                                   </span>
                                 )}
                               </div>
                               <div className="text-xs text-slate-500 truncate">{file.path}</div>
                            </div>
                         </div>
                         <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
                            <span>{(file.size / 1024).toFixed(1)} KB</span>
                            <span className="flex items-center gap-1">
                               <Clock size={10} />
                               {new Date(file.modified).toLocaleDateString()}
                            </span>
                         </div>
                      </div>
                   ))
                )}
             </div>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
           <h3 className="text-slate-200 font-semibold mb-4">Active Modules</h3>
           <div className="space-y-3">
             <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded border border-slate-700/50">
               <span className="flex items-center gap-2 text-sm text-slate-300">
                 <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                 gemini-cli-bridge
               </span>
               <span className="text-xs font-mono text-slate-500">PID: 4421</span>
             </div>
             <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded border border-slate-700/50">
               <span className="flex items-center gap-2 text-sm text-slate-300">
                 <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                 opencode-gui-server
               </span>
               <span className="text-xs font-mono text-slate-500">PID: 4425</span>
             </div>
           </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
           <h3 className="text-slate-200 font-semibold mb-4">System Resources</h3>
           <div className="space-y-4">
             <div>
               <div className="flex justify-between text-xs text-slate-400 mb-1">
                 <span>CPU Usage</span>
                 <span>12%</span>
               </div>
               <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                 <div className="h-full bg-blue-500 w-[12%]"></div>
               </div>
             </div>
             <div>
               <div className="flex justify-between text-xs text-slate-400 mb-1">
                 <span>Memory (Bun)</span>
                 <span>128MB / 4GB</span>
               </div>
               <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                 <div className="h-full bg-purple-500 w-[4%]"></div>
               </div>
             </div>
             <div>
               <div className="flex justify-between text-xs text-slate-400 mb-1">
                 <span>Context Window (Gemini-CLI)</span>
                 <span>124k / 2M Tokens</span>
               </div>
               <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                 <div className="h-full bg-yellow-500 w-[6%]"></div>
               </div>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardTab;