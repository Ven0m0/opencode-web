import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Trash2, Loader2, Sparkles, TerminalSquare, Command, Wand2, ArchiveRestore, Paperclip, Database, History, Clock, Users, Plus, X, Globe, Cpu, Zap, ArrowRight, Layers, ChevronLeft, ChevronRight, BrainCircuit, Code, Braces } from 'lucide-react';
import { MessageRole, ChatMessage, Agent, AppSettings, ChatMode } from '../types';
import { createChatSession, sendMessage, optimizePrompt, compactChatHistory, fetchRelevantContext, ChatSession, repairJson } from '../services/geminiService';

interface ChatTabProps {
  activeAgent?: Agent;
  agents?: Agent[];
  onLog: (message: string, level: 'info' | 'warn' | 'error' | 'success') => void;
}

// Message Component to handle text vs JSON views
const MessageContent = ({ text, role }: { text: string; role: MessageRole }) => {
  const [viewMode, setViewMode] = useState<'text' | 'json'>('text');
  const [parsedJson, setParsedJson] = useState<any>(null);

  useEffect(() => {
    // Attempt to repair/parse JSON on mount if it looks like code
    if (role === MessageRole.MODEL) {
      const json = repairJson(text);
      if (json) setParsedJson(json);
    }
  }, [text, role]);

  if (viewMode === 'json' && parsedJson) {
    return (
      <div className="relative group">
        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
           <button onClick={() => setViewMode('text')} className="p-1.5 bg-slate-700 rounded text-xs text-slate-300 hover:text-white">
             Show Text
           </button>
        </div>
        <pre className="bg-slate-950 p-4 rounded-lg overflow-x-auto border border-slate-800 text-xs font-mono text-emerald-400">
          {JSON.stringify(parsedJson, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div className="relative group">
       {parsedJson && (
          <div className="absolute -top-6 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
             <button onClick={() => setViewMode('json')} className="flex items-center gap-1 text-[10px] bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800">
               <Braces size={10} /> View JSON
             </button>
          </div>
       )}
       <div className={`whitespace-pre-wrap leading-relaxed ${role === MessageRole.USER ? 'text-slate-200' : 'text-slate-300'}`}>
         {text}
       </div>
    </div>
  );
};

const ChatTab: React.FC<ChatTabProps> = ({ activeAgent, agents = [], onLog }) => {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [chatMode, setChatMode] = useState<ChatMode>('standard');
  
  // Settings Context
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
     const saved = localStorage.getItem('opencode_settings');
     return saved ? JSON.parse(saved) : { 
         activeProvider: 'gemini', 
         apiKeys: {}, 
         openRouterModel: 'anthropic/claude-3.5-sonnet' 
     } as AppSettings;
  });

  // Re-read settings
  useEffect(() => {
     const saved = localStorage.getItem('opencode_settings');
     if (saved) setAppSettings(JSON.parse(saved));
  }, []);

  // Team Mode State
  const [isTeamMode, setIsTeamMode] = useState(false);
  const [workflowMode, setWorkflowMode] = useState<'parallel' | 'sequential'>('parallel');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [teamSessions, setTeamSessions] = useState<Record<string, ChatSession>>({});
  const [showAgentSelector, setShowAgentSelector] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);
  
  // Prompt History State
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const savedHistory = localStorage.getItem('chat_prompt_history');
    if (savedHistory) {
      setPromptHistory(JSON.parse(savedHistory));
    }

    // Initialize Single Mode Chat
    const initChat = () => {
      try {
        const agentName = activeAgent ? activeAgent.name : 'OpenCode Assistant';
        const instruction = activeAgent ? activeAgent.systemInstruction : undefined;
        
        // Re-initialize if agent OR mode changes
        const shouldReinit = currentAgentId !== (activeAgent?.id || 'default') || !session || session.mode !== chatMode;

        if (shouldReinit && !isTeamMode) {
            const newSession = createChatSession(appSettings.activeProvider, instruction, undefined, chatMode);
            setSession(newSession);
            setCurrentAgentId(activeAgent?.id || 'default');
            
            // Initial message
            if (messages.length === 0) {
              setMessages([{
                id: 'init-' + Date.now(),
                role: MessageRole.MODEL,
                text: `Initialized ${agentName} using ${appSettings.activeProvider} (${chatMode}).`,
                timestamp: new Date(),
                agentName: agentName,
                mode: chatMode
              }]);
            } 
        }
      } catch (e) {
        onLog(`Failed to initialize chat: ${e}`, 'error');
      }
    };

    if (!isTeamMode) {
      initChat();
    }
  }, [activeAgent, isTeamMode, appSettings.activeProvider, chatMode]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const saveToHistory = (text: string) => {
    if (!text.trim() || text.startsWith('/')) return;
    setPromptHistory(prev => {
      const newHistory = [text, ...prev.filter(p => p !== text)].slice(0, 20); // Keep last 20
      localStorage.setItem('chat_prompt_history', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (!isTeamMode && !session) return;
    if (isTeamMode && selectedAgentIds.length === 0) {
        onLog('Select at least one agent for the team.', 'warn');
        return;
    }

    setIsLoading(true);
    const originalInput = input;
    saveToHistory(originalInput);
    setInput('');
    setShowHistory(false);
    
    // Dynamic Context Retrieval (Simulated)
    let contextData = { context: "", sources: [] as string[] };
    try {
        contextData = await fetchRelevantContext(originalInput);
    } catch (e) {
        // silent fail
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      text: originalInput,
      timestamp: new Date(),
      contextSources: contextData.sources,
      mode: chatMode
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    
    const baseMessage = contextData.context 
        ? `[CONTEXT]\n${contextData.context}\n[END CONTEXT]\n\n${originalInput}`
        : originalInput;

    if (isTeamMode) {
        // Parallel Team Execution
         const promises = selectedAgentIds.map(async (agentId) => {
            const agent = agents.find(a => a.id === agentId);
            if (!agent) return;
            let agentSession = teamSessions[agentId];
            if (!agentSession) {
                agentSession = createChatSession(appSettings.activeProvider, agent.systemInstruction, undefined, chatMode);
                setTeamSessions(prev => ({...prev, [agentId]: agentSession}));
            }
            try {
                const response = await sendMessage(agentSession, baseMessage, newMessages, appSettings);
                const modelMsg: ChatMessage = {
                    id: `${Date.now()}-${agentId}`,
                    role: MessageRole.MODEL,
                    text: response.text,
                    contextSources: response.sources,
                    timestamp: new Date(),
                    agentName: agent.name
                };
                setMessages(prev => [...prev, modelMsg]);
            } catch (err) { onLog(`Agent failed: ${err}`, 'error'); }
         });
         await Promise.all(promises);
    } else {
        // Single Mode
        if (!session) return;
        try {
          const response = await sendMessage(session, baseMessage, newMessages, appSettings);
          const modelMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: MessageRole.MODEL,
            text: response.text,
            contextSources: response.sources,
            timestamp: new Date(),
            agentName: activeAgent?.name || 'OpenCode',
            mode: chatMode
          };
          setMessages(prev => [...prev, modelMsg]);
        } catch (error) {
          onLog(`API Error: ${error}`, 'error');
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: MessageRole.SYSTEM,
            text: `Error communicating with ${appSettings.activeProvider}.`,
            timestamp: new Date()
          }]);
        }
    }

    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    if (confirm("Clear current context?")) {
      setMessages([]);
      if (isTeamMode) {
          setTeamSessions({});
      } else {
          const instruction = activeAgent ? activeAgent.systemInstruction : undefined;
          setSession(createChatSession(appSettings.activeProvider, instruction, undefined, chatMode));
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 font-sans">
      {/* Header - Minimalist */}
      <div className="h-14 flex items-center justify-between px-6 bg-slate-950/80 backdrop-blur-md z-10 sticky top-0 border-b border-slate-900">
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 text-slate-200 font-medium">
              {activeAgent ? <Bot size={18} className="text-indigo-400" /> : <Sparkles size={18} className="text-indigo-400" />}
              <span>{activeAgent ? activeAgent.name : 'OpenCode Chat'}</span>
           </div>
           
           {/* Model/Mode Pill */}
           <div className="flex bg-slate-900 rounded-full p-1 border border-slate-800">
              <button 
                onClick={() => setChatMode('standard')}
                className={`px-3 py-1 rounded-full text-xs transition-colors ${chatMode === 'standard' ? 'bg-slate-800 text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Standard
              </button>
              <button 
                onClick={() => setChatMode('thinking')}
                className={`px-3 py-1 rounded-full text-xs transition-colors ${chatMode === 'thinking' ? 'bg-slate-800 text-purple-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Reasoning
              </button>
              <button 
                onClick={() => setChatMode('search')}
                className={`px-3 py-1 rounded-full text-xs transition-colors ${chatMode === 'search' ? 'bg-slate-800 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Search
              </button>
           </div>
        </div>

        <div className="flex items-center gap-2">
           <button 
             onClick={handleClear}
             className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-900 rounded-lg transition-colors"
             title="Clear Chat"
           >
             <Trash2 size={16} />
           </button>
        </div>
      </div>

      {/* Main Chat Area - Centered Layout */}
      <div className="flex-1 overflow-y-auto relative" ref={scrollRef}>
        <div className="max-w-3xl mx-auto w-full px-4 py-8 space-y-8">
           
           {messages.map((msg) => (
             <div key={msg.id} className={`flex gap-4 group ${msg.role === MessageRole.USER ? 'flex-row-reverse' : ''}`}>
                
                {/* Avatar */}
                <div className={`
                  w-8 h-8 rounded-lg flex items-center justify-center shrink-0 
                  ${msg.role === MessageRole.USER ? 'bg-indigo-600/20 text-indigo-400' : 'bg-slate-800 text-slate-400'}
                `}>
                   {msg.role === MessageRole.USER ? <User size={16} /> : <Bot size={16} />}
                </div>

                {/* Message Content */}
                <div className={`flex flex-col max-w-[85%] ${msg.role === MessageRole.USER ? 'items-end' : 'items-start'}`}>
                   {msg.agentName && msg.role !== MessageRole.USER && (
                      <span className="text-[10px] text-slate-500 mb-1 font-bold uppercase tracking-wider">{msg.agentName}</span>
                   )}
                   
                   <div className={`
                     text-sm rounded-2xl px-5 py-3 shadow-sm
                     ${msg.role === MessageRole.USER 
                        ? 'bg-slate-800 text-slate-100 rounded-tr-sm' 
                        : 'bg-transparent text-slate-300 px-0 py-0 shadow-none'} 
                   `}>
                      <MessageContent text={msg.text} role={msg.role} />
                   </div>

                   {/* Sources / Metadata */}
                   {msg.contextSources && msg.contextSources.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                         {msg.contextSources.map((src, i) => (
                            <a 
                              key={i} href={src} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-[10px] bg-slate-900 border border-slate-800 px-2 py-1 rounded-full text-slate-500 hover:text-indigo-400 hover:border-indigo-500/50 transition-colors"
                            >
                               <Globe size={10} />
                               {new URL(src).hostname.replace('www.', '')}
                            </a>
                         ))}
                      </div>
                   )}
                </div>
             </div>
           ))}

           {isLoading && (
              <div className="flex gap-4">
                 <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                    <Loader2 size={16} className="animate-spin text-indigo-400" />
                 </div>
                 <div className="flex items-center text-sm text-slate-500">
                    Thinking...
                 </div>
              </div>
           )}

           <div className="h-24"></div> {/* Spacer for fixed input */}
        </div>
      </div>

      {/* Input Area - Floating & Centered */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent">
         <div className="max-w-3xl mx-auto relative bg-slate-900 border border-slate-800 rounded-xl shadow-2xl shadow-black/50 overflow-hidden focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all">
            
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message OpenCode..."
              className="w-full bg-transparent border-none outline-none text-slate-200 px-4 py-4 min-h-[60px] max-h-[200px] resize-none text-sm placeholder:text-slate-600"
              style={{ height: 'auto' }}
            />

            <div className="flex justify-between items-center px-2 pb-2">
               <div className="flex items-center gap-1">
                  <button onClick={() => setShowHistory(!showHistory)} className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors" title="History">
                     <History size={16} />
                  </button>
                  <button className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors" title="Attach">
                     <Paperclip size={16} />
                  </button>
                  {input.length > 5 && (
                     <button onClick={() => {}} className="p-2 text-purple-500 hover:text-purple-400 hover:bg-slate-800 rounded-lg transition-colors" title="Improve Prompt">
                        <Wand2 size={16} />
                     </button>
                  )}
               </div>

               <button 
                 onClick={handleSend}
                 disabled={!input.trim() || isLoading}
                 className={`
                    p-2 rounded-lg transition-all
                    ${input.trim() && !isLoading ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}
                 `}
               >
                  <ArrowRight size={18} />
               </button>
            </div>
            
            {/* History Popover */}
            {showHistory && (
               <div className="absolute bottom-full left-0 mb-2 w-64 bg-slate-900 border border-slate-800 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                  <div className="p-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-950/50">Recent</div>
                  <div className="max-h-48 overflow-y-auto">
                     {promptHistory.map((h, i) => (
                        <button 
                           key={i} 
                           onClick={() => { setInput(h); setShowHistory(false); }}
                           className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 truncate"
                        >
                           {h}
                        </button>
                     ))}
                  </div>
               </div>
            )}
         </div>
         <div className="text-center mt-2 text-[10px] text-slate-600">
            OpenCode Studio can make mistakes. Verify important information.
         </div>
      </div>
    </div>
  );
};

export default ChatTab;
