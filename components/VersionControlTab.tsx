import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { GitBranch, GitCommit, GitPullRequest, GitMerge, UploadCloud, DownloadCloud, RefreshCw, Check, Plus, AlertCircle, Sparkles, Terminal, FileDiff, Loader2, Eye, FileText, X, AlertTriangle, Wand2, ArrowRight, Bot } from 'lucide-react';
import { generateCommitMessage, generatePrDescription, generateCodeReview, resolveMergeConflict } from '../services/geminiService';

interface VersionControlTabProps {
  onLog: (message: string, level: 'info' | 'warn' | 'error' | 'success') => void;
}

const VersionControlTab: React.FC<VersionControlTabProps> = ({ onLog }) => {
  const [activeSubTab, setActiveSubTab] = useState<'changes' | 'issues' | 'prs'>('changes');
  const [status, setStatus] = useState<string>('');
  const [issues, setIssues] = useState<any[]>([]);
  const [prs, setPrs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Conflict State
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [resolvingFile, setResolvingFile] = useState<string | null>(null);

  // Zagi State
  const [commitMessage, setCommitMessage] = useState('');
  const [isGeneratingCommit, setIsGeneratingCommit] = useState(false);
  const [reviewContent, setReviewContent] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [prDraft, setPrDraft] = useState<string | null>(null);
  const [isDraftingPr, setIsDraftingPr] = useState(false);

  const executeGit = async (command: string, args: string[] = []) => {
     try {
         setIsLoading(true);
         const res = await fetch('/api/git', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ command, args })
         });
         const data = await res.json();
         if (data.stderr) {
             // Heuristic: if exitCode is 0, it might just be info/progress
             if (data.exitCode === 0) {
                onLog(data.stderr, 'info');
             } else {
                onLog(data.stderr, 'warn');
             }
         }
         return data.stdout || '';
     } catch (e) {
         onLog(`Git error: ${e}`, 'error');
         return '';
     } finally {
         setIsLoading(false);
     }
  };

  const executeGh = async (command: string, args: string[] = []) => {
     try {
         setIsLoading(true);
         const res = await fetch('/api/gh', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ command, args })
         });
         const data = await res.json();
         if (data.stderr) console.warn(data.stderr);
         return data.stdout || '';
     } catch (e) {
         onLog(`GitHub CLI error: ${e}`, 'error');
         return '';
     } finally {
         setIsLoading(false);
     }
  };

  const refreshStatus = async () => {
      // Get raw status for display
      const displayOut = await executeGit('status');
      setStatus(displayOut);

      // Get porcelain status for logic
      try {
        const porcelain = await executeGit('status', ['--porcelain']);
        const conflictLines = porcelain.split('\n').filter(l => 
          l.startsWith('UU ') || l.startsWith('AA ') || l.startsWith('DD ') || 
          l.startsWith('AU ') || l.startsWith('UA ') || l.startsWith('DU ') || l.startsWith('UD ')
        );
        setConflicts(conflictLines.map(l => l.substring(3).trim()));
      } catch (e) {
        console.error("Failed to parse porcelain status", e);
      }
  };

  const refreshIssues = async () => {
      const out = await executeGh('issue', ['list', '--limit', '20', '--json', 'number,title,state,author,createdAt']);
      try {
          setIssues(JSON.parse(out));
      } catch (e) { setIssues([]); }
  };

  const refreshPrs = async () => {
      const out = await executeGh('pr', ['list', '--limit', '20', '--json', 'number,title,state,author,createdAt,headRefName']);
      try {
          setPrs(JSON.parse(out));
      } catch (e) { setPrs([]); }
  };

  useEffect(() => {
      if (activeSubTab === 'changes') refreshStatus();
      if (activeSubTab === 'issues') refreshIssues();
      if (activeSubTab === 'prs') refreshPrs();
  }, [activeSubTab]);

  const getDiff = async () => {
      const diff = await executeGit('diff');
      const cachedDiff = await executeGit('diff', ['--cached']);
      const combinedDiff = diff + "\n" + cachedDiff;
      return combinedDiff;
  }

  // --- Merge Conflict Resolution ---
  const handleAcceptOurs = async (file: string) => {
      onLog(`Resolving ${file} using ours (current)...`, 'info');
      await executeGit('checkout', ['--ours', file]);
      await executeGit('add', [file]);
      onLog(`Resolved ${file}`, 'success');
      refreshStatus();
  };

  const handleAcceptTheirs = async (file: string) => {
      onLog(`Resolving ${file} using theirs (incoming)...`, 'info');
      await executeGit('checkout', ['--theirs', file]);
      await executeGit('add', [file]);
      onLog(`Resolved ${file}`, 'success');
      refreshStatus();
  };

  const handleAIResolve = async (file: string) => {
      setResolvingFile(file);
      onLog(`AI resolving conflict in ${file}...`, 'info');
      try {
          // 1. Fetch file content (which has markers)
          const res = await fetch(`/api/workspace/file?path=${encodeURIComponent(file)}`);
          if (!res.ok) throw new Error("Failed to read file");
          const content = await res.text();

          // 2. Resolve via Gemini
          const resolved = await resolveMergeConflict(content);

          // 3. Write back
          await fetch(`/api/workspace/file?path=${encodeURIComponent(file)}`, {
              method: 'POST',
              body: resolved
          });

          // 4. Mark as resolved
          await executeGit('add', [file]);
          onLog(`AI successfully resolved ${file}`, 'success');
          refreshStatus();
      } catch (e) {
          onLog(`AI Resolution failed: ${e}`, 'error');
      } finally {
          setResolvingFile(null);
      }
  };

  // --- Zagi Features ---
  const handleGenerateCommit = async () => {
      setIsGeneratingCommit(true);
      const combinedDiff = await getDiff();
      
      if (!combinedDiff.trim()) {
          onLog('No changes detected to generate commit message.', 'warn');
          setIsGeneratingCommit(false);
          return;
      }

      const msg = await generateCommitMessage(combinedDiff);
      setCommitMessage(msg);
      setIsGeneratingCommit(false);
  };

  const handleZagiReview = async () => {
      setIsReviewing(true);
      setReviewContent(null);
      const combinedDiff = await getDiff();
      
      if (!combinedDiff.trim()) {
          onLog('No changes detected to review.', 'warn');
          setIsReviewing(false);
          return;
      }
      
      const review = await generateCodeReview(combinedDiff);
      setReviewContent(review);
      setIsReviewing(false);
  };

  const handleDraftPr = async () => {
      setIsDraftingPr(true);
      setPrDraft(null);
      const combinedDiff = await getDiff();
      
      // Get current branch
      const statusOut = await executeGit('status');
      const branch = statusOut.match(/On branch (.+)/)?.[1] || 'unknown';

      if (!combinedDiff.trim()) {
          onLog('No changes detected to draft PR.', 'warn');
          setIsDraftingPr(false);
          return;
      }

      const draft = await generatePrDescription(combinedDiff, branch);
      setPrDraft(draft);
      setIsDraftingPr(false);
  };

  const handleCommit = async () => {
      if (!commitMessage) return;
      await executeGit('commit', ['-m', commitMessage]);
      setCommitMessage('');
      refreshStatus();
      onLog('Changes committed locally.', 'success');
  };

  const handlePush = async () => {
      onLog('Pushing to remote...', 'info');
      const out = await executeGit('push');
      if (out && typeof out === 'string') {
          out.split('\n').filter(Boolean).forEach(line => onLog(line, 'info'));
      }
      onLog('Git push completed.', 'success');
  };

  const handlePull = async () => {
      onLog('Pulling from remote...', 'info');
      const out = await executeGit('pull');
      if (out && typeof out === 'string') {
          out.split('\n').filter(Boolean).forEach(line => onLog(line, 'info'));
      }
      refreshStatus();
      onLog('Git pull completed.', 'success');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">
       {/* Header */}
       <div className="h-12 border-b border-slate-700 flex items-center justify-between px-6 bg-slate-800/50 shrink-0">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <GitBranch size={18} className="text-orange-400" />
          VERSION CONTROL
        </h2>
        <div className="flex gap-2">
            <button 
              onClick={handlePull} 
              disabled={isLoading}
              className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded border border-slate-700 disabled:opacity-50"
            >
                {isLoading ? <Loader2 size={12} className="animate-spin" /> : <DownloadCloud size={12} />} 
                Pull
            </button>
            <button 
              onClick={handlePush} 
              disabled={isLoading}
              className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded border border-slate-700 disabled:opacity-50"
            >
                {isLoading ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />} 
                Push
            </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
         {/* Sidebar/Tabs */}
         <div className="w-48 bg-slate-900 border-r border-slate-800 flex flex-col">
             <button 
               onClick={() => setActiveSubTab('changes')}
               className={`flex items-center gap-2 px-4 py-3 text-sm transition-colors ${activeSubTab === 'changes' ? 'bg-slate-800 text-white border-l-2 border-orange-400' : 'text-slate-400 hover:bg-slate-800/50'}`}
             >
                 <FileDiff size={14} /> Changes
             </button>
             <button 
               onClick={() => setActiveSubTab('issues')}
               className={`flex items-center gap-2 px-4 py-3 text-sm transition-colors ${activeSubTab === 'issues' ? 'bg-slate-800 text-white border-l-2 border-green-400' : 'text-slate-400 hover:bg-slate-800/50'}`}
             >
                 <AlertCircle size={14} /> Issues
             </button>
             <button 
               onClick={() => setActiveSubTab('prs')}
               className={`flex items-center gap-2 px-4 py-3 text-sm transition-colors ${activeSubTab === 'prs' ? 'bg-slate-800 text-white border-l-2 border-purple-400' : 'text-slate-400 hover:bg-slate-800/50'}`}
             >
                 <GitPullRequest size={14} /> Pull Requests
             </button>
         </div>

         {/* Content Area */}
         <div className="flex-1 overflow-y-auto p-6 relative">
             
             {/* CHANGES TAB */}
             {activeSubTab === 'changes' && (
                 <div className="flex flex-col h-full gap-6">
                     <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-slate-500">Current Branch: {status.match(/On branch (.+)/)?.[1] || 'unknown'}</span>
                        <div className="flex gap-2">
                           <button onClick={refreshStatus} className="text-slate-500 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"><RefreshCw size={14}/></button>
                        </div>
                     </div>
                     
                     {/* Zagi AI Toolbar */}
                     <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-lg p-3 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                             <div className="bg-indigo-500/20 p-1.5 rounded-md">
                                <Bot size={16} className="text-indigo-400" />
                             </div>
                             <div>
                                 <div className="text-xs font-bold text-indigo-300">Zagi AI Assistant</div>
                                 <div className="text-[10px] text-indigo-400/60">Automated Git Tasks</div>
                             </div>
                         </div>
                         <div className="flex gap-2">
                             <button 
                               onClick={handleZagiReview}
                               disabled={isReviewing}
                               className="text-xs flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 px-3 py-1.5 rounded border border-slate-700 transition-all disabled:opacity-50"
                             >
                                 {isReviewing ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />} 
                                 Review Changes
                             </button>
                             <button 
                               onClick={handleDraftPr}
                               disabled={isDraftingPr}
                               className="text-xs flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-blue-300 px-3 py-1.5 rounded border border-slate-700 transition-all disabled:opacity-50"
                             >
                                 {isDraftingPr ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />} 
                                 Draft PR
                             </button>
                         </div>
                     </div>

                     {/* CONFLICTS SECTION */}
                     {conflicts.length > 0 && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 animate-in fade-in slide-in-from-top-2">
                            <h3 className="text-red-400 font-semibold text-sm flex items-center gap-2 mb-3">
                                <AlertTriangle size={16} /> Merge Conflicts Detected
                            </h3>
                            <div className="space-y-2">
                                {conflicts.map(file => (
                                    <div key={file} className="flex items-center justify-between bg-slate-900/50 p-2 rounded border border-red-500/20">
                                        <div className="flex items-center gap-2">
                                            <GitMerge size={14} className="text-red-400" />
                                            <span className="text-sm font-mono text-slate-200">{file}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleAcceptOurs(file)}
                                                className="px-2 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-slate-300 transition-colors"
                                                title="Keep Current (HEAD)"
                                            >
                                                Use Ours
                                            </button>
                                            <button 
                                                onClick={() => handleAcceptTheirs(file)}
                                                className="px-2 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-slate-300 transition-colors"
                                                title="Accept Incoming"
                                            >
                                                Use Theirs
                                            </button>
                                            <button 
                                                onClick={() => handleAIResolve(file)}
                                                disabled={resolvingFile === file}
                                                className="px-2 py-1 text-[10px] bg-purple-900/40 hover:bg-purple-900/60 border border-purple-500/30 text-purple-300 rounded flex items-center gap-1 transition-colors"
                                            >
                                                {resolvingFile === file ? <Loader2 size={10} className="animate-spin" /> : <Wand2 size={10} />}
                                                AI Resolve
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                     )}

                     <div className="flex-1 bg-slate-800 border border-slate-700 rounded-xl p-4 font-mono text-xs overflow-auto whitespace-pre custom-scrollbar relative">
                         {status || "No changes or not a git repository."}
                         
                         {/* Review Overlay */}
                         {reviewContent && (
                            <div className="absolute inset-0 bg-slate-900/95 z-10 backdrop-blur-sm animate-in fade-in flex flex-col">
                               <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-900/80 shrink-0">
                                  <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                                     <Eye size={20} className="text-purple-400" /> Zagi Code Review
                                  </h3>
                                  <button onClick={() => setReviewContent(null)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"><X size={16} /></button>
                               </div>
                               <div className="flex-1 overflow-auto p-6 font-sans">
                                  <ReactMarkdown className="prose prose-invert prose-sm max-w-none prose-headings:text-indigo-300 prose-a:text-blue-400">
                                     {reviewContent}
                                  </ReactMarkdown>
                               </div>
                            </div>
                         )}

                         {/* PR Draft Overlay */}
                         {prDraft && (
                            <div className="absolute inset-0 bg-slate-900/95 z-10 backdrop-blur-sm animate-in fade-in flex flex-col">
                               <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-900/80 shrink-0">
                                  <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                                     <FileText size={20} className="text-blue-400" /> PR Draft (Zagi)
                                  </h3>
                                  <div className="flex gap-2">
                                     <button 
                                        onClick={() => { navigator.clipboard.writeText(prDraft); onLog("PR Draft copied!", "success"); }}
                                        className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded"
                                     >
                                        Copy
                                     </button>
                                     <button onClick={() => setPrDraft(null)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"><X size={16} /></button>
                                  </div>
                               </div>
                               <textarea 
                                  readOnly 
                                  value={prDraft} 
                                  className="flex-1 w-full bg-slate-800 p-4 text-sm font-mono focus:outline-none resize-none m-4 rounded border border-slate-700"
                               />
                            </div>
                         )}
                     </div>
                     
                     {/* Commit Area (Zagi) */}
                     <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                         <div className="flex items-center justify-between mb-2">
                             <h3 className="text-sm font-semibold flex items-center gap-2">
                                 <GitCommit size={14} className="text-orange-400" /> Commit Changes
                             </h3>
                             <button 
                                onClick={handleGenerateCommit}
                                disabled={isGeneratingCommit}
                                className="text-xs flex items-center gap-1.5 text-purple-400 hover:text-purple-300 transition-colors bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20"
                             >
                                <Sparkles size={12} className={isGeneratingCommit ? "animate-spin" : ""} />
                                Generate Message (Zagi)
                             </button>
                         </div>
                         <textarea 
                             value={commitMessage}
                             onChange={(e) => setCommitMessage(e.target.value)}
                             placeholder="Enter commit message..."
                             className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-sm focus:border-orange-500 outline-none h-24 mb-3 resize-none font-mono"
                         />
                         <div className="flex justify-end gap-2">
                             <button 
                               onClick={() => executeGit('add', ['.'])} 
                               disabled={isLoading}
                               className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs transition-colors"
                             >
                                 Stage All
                             </button>
                             <button 
                               onClick={handleCommit}
                               disabled={isLoading || !commitMessage}
                               className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded text-xs font-medium transition-colors"
                             >
                                 Commit
                             </button>
                         </div>
                     </div>
                 </div>
             )}

             {/* ISSUES TAB */}
             {activeSubTab === 'issues' && (
                 <div className="space-y-4">
                     <div className="flex justify-between items-center mb-4">
                         <h3 className="text-lg font-semibold">GitHub Issues</h3>
                         <button onClick={refreshIssues} className="p-2 hover:bg-slate-800 rounded"><RefreshCw size={14} /></button>
                     </div>
                     {issues.length === 0 && <div className="text-slate-500 text-sm italic">No issues found or not authenticated via 'gh auth login'.</div>}
                     {issues.map(issue => (
                         <div key={issue.number} className="bg-slate-800 border border-slate-700 rounded p-3 flex items-start gap-3 hover:border-slate-600 transition-colors">
                             <AlertCircle size={16} className="text-green-500 mt-1" />
                             <div>
                                 <div className="font-medium text-sm text-slate-200">{issue.title} <span className="text-slate-500">#{issue.number}</span></div>
                                 <div className="text-xs text-slate-500 mt-1">
                                     opened by {issue.author.login} on {new Date(issue.createdAt).toLocaleDateString()}
                                 </div>
                             </div>
                         </div>
                     ))}
                 </div>
             )}

             {/* PRs TAB */}
             {activeSubTab === 'prs' && (
                 <div className="space-y-4">
                     <div className="flex justify-between items-center mb-4">
                         <h3 className="text-lg font-semibold">Pull Requests</h3>
                         <button onClick={refreshPrs} className="p-2 hover:bg-slate-800 rounded"><RefreshCw size={14} /></button>
                     </div>
                     {prs.length === 0 && <div className="text-slate-500 text-sm italic">No PRs found.</div>}
                     {prs.map(pr => (
                         <div key={pr.number} className="bg-slate-800 border border-slate-700 rounded p-3 flex items-start gap-3 hover:border-slate-600 transition-colors">
                             <GitPullRequest size={16} className="text-purple-500 mt-1" />
                             <div>
                                 <div className="font-medium text-sm text-slate-200">{pr.title} <span className="text-slate-500">#{pr.number}</span></div>
                                 <div className="text-xs text-slate-500 mt-1">
                                     {pr.headRefName} • opened by {pr.author.login}
                                 </div>
                             </div>
                         </div>
                     ))}
                 </div>
             )}
         </div>
      </div>
    </div>
  );
};

export default VersionControlTab;