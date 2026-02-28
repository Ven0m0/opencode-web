import React, { useState, useEffect } from 'react';
import { MessageSquare, Image, Settings, Code2, Server, LayoutDashboard, Bot, Plug, FileCode, FolderClosed, ChevronLeft, ChevronRight, GitBranch } from 'lucide-react';
import ChatTab from './components/ChatTab';
import VisionTab from './components/VisionTab';
import Terminal from './components/Terminal';
import DashboardTab from './components/DashboardTab';
import MCPServerTab from './components/MCPServerTab';
import AgentTab from './components/AgentTab';
import SettingsTab from './components/SettingsTab';
import FileExplorer from './components/FileExplorer';
import EditorTab from './components/EditorTab';
import VersionControlTab from './components/VersionControlTab';
import { Tab, LogEntry, Agent, AppSettings } from './types';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DASHBOARD);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);
  const [isSidePaneOpen, setIsSidePaneOpen] = useState(true);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  
  // App Settings State
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('opencode_settings');
    const defaultExtensions = ['ts', 'tsx', 'js', 'jsx', 'json', 'md', 'txt', 'html', 'css', 'scss', 'py', 'java', 'env'];
    
    if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure allowedExtensions exists for migration
        if (!parsed.allowedExtensions) parsed.allowedExtensions = defaultExtensions;
        return parsed;
    }

    return {
      theme: 'dark',
      fontFamily: 'Inter',
      wordWrap: true,
      showLineNumbers: true,
      allowedExtensions: defaultExtensions,
      activeProvider: 'gemini',
      apiKeys: {},
      openRouterModel: 'anthropic/claude-3.5-sonnet',
      anthropicModel: 'claude-3-5-sonnet-20240620'
    } as AppSettings;
  });

  // Sync index settings with server on mount
  useEffect(() => {
    if (settings.allowedExtensions) {
        fetch('/api/indexing/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ allowedExtensions: settings.allowedExtensions })
        }).catch(err => console.error("Failed to sync index settings", err));
    }
  }, [settings.allowedExtensions]);

  // Agents State
  const [agents, setAgents] = useState<Agent[]>([
    {
      id: 'default-coder',
      name: 'Code Architect',
      model: 'gemini-3-pro-preview',
      systemInstruction: 'You are an expert software architect. Focus on design patterns, scalability, and best practices. Always provide high-level structural advice before code.',
      capabilities: ['coding', 'architecture']
    },
    {
      id: 'default-reviewer',
      name: 'Security Auditor',
      model: 'gemini-3-pro-preview',
      systemInstruction: 'You are a security auditor. Analyze code specifically for vulnerabilities (OWASP Top 10) and suggest secure alternatives. Be critical and paranoid.',
      capabilities: ['security', 'auditing']
    },
    {
      id: 'default-qa',
      name: 'QA Engineer',
      model: 'gemini-3-pro-preview',
      systemInstruction: 'You are a QA Automation Engineer. Generate test cases (Jest/Vitest) and edge cases for the provided code.',
      capabilities: ['testing', 'qa']
    }
  ]);
  
  const [activeAgent, setActiveAgent] = useState<Agent | undefined>(undefined);

  const addLog = (message: string, level: 'info' | 'warn' | 'error' | 'success') => {
    setLogs(prev => [
      ...prev, 
      { 
        id: Date.now().toString() + Math.random(), 
        timestamp: new Date(), 
        level, 
        message 
      }
    ]);
  };

  // WebSocket Connection for Live File Updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;
    
    let ws: WebSocket;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          addLog('Connected to File System Watcher', 'success');
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'file_change') {
              addLog(`FileSystem: ${data.event} detected in ${data.path}`, 'info');
            }
          } catch (e) {
            console.error("Failed to parse WS message", e);
          }
        };

        ws.onclose = () => {
          addLog('File System Watcher disconnected. Reconnecting...', 'warn');
          setTimeout(connect, 3000);
        };
        
        ws.onerror = (err) => {
          console.error("WebSocket error", err);
        };
      } catch (e) {
        console.error("WebSocket setup failed", e);
      }
    };

    connect();

    return () => {
      if (ws) ws.close();
    };
  }, []);

  const handleAgentSelect = (agent: Agent) => {
    setActiveAgent(agent);
    setActiveTab(Tab.CHAT);
    addLog(`Switched context to agent: ${agent.name}`, 'info');
  };

  const handleFileOpen = (path: string) => {
    setCurrentFilePath(path);
    setActiveTab(Tab.EDITOR);
    addLog(`Opened workspace file: ${path}`, 'info');
  };

  const renderContent = () => {
    switch (activeTab) {
      case Tab.DASHBOARD:
        return <DashboardTab onLog={addLog} />;
      case Tab.MCP:
        return <MCPServerTab onLog={addLog} />;
      case Tab.AGENTS:
        return <AgentTab agents={agents} setAgents={setAgents} onLog={addLog} onSelectAgent={handleAgentSelect} />;
      case Tab.VISION:
        return <VisionTab onLog={addLog} />;
      case Tab.SETTINGS:
        return <SettingsTab settings={settings} onUpdateSettings={setSettings} onLog={addLog} />;
      case Tab.VERSION_CONTROL:
        return <VersionControlTab onLog={addLog} />;
      case Tab.EDITOR:
        return currentFilePath ? (
          <EditorTab 
            filePath={currentFilePath} 
            onLog={addLog} 
            onClose={() => setActiveTab(Tab.DASHBOARD)} 
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 bg-slate-900 font-mono italic">
            <FileCode size={48} className="mb-4 opacity-20" />
            Select a file from the explorer to begin editing.
          </div>
        );
      case Tab.CHAT:
      default:
        return <ChatTab activeAgent={activeAgent} agents={agents} onLog={addLog} />;
    }
  };

  return (
    <div 
      className={`h-screen w-screen flex text-slate-200 overflow-hidden ${settings.theme === 'light' ? 'bg-slate-100' : 'bg-slate-950'}`}
      style={{ fontFamily: settings.fontFamily === 'System' ? 'sans-serif' : settings.fontFamily }}
    >
      
      {/* Activity Bar (Sidebar) */}
      <div className="w-14 bg-slate-950 border-r border-slate-800 flex flex-col items-center py-4 gap-4 z-20 shadow-xl shrink-0">
        <div className="mb-4 text-blue-500 p-2 bg-blue-500/10 rounded-lg">
           <Code2 size={24} />
        </div>
        
        <NavButton 
          active={activeTab === Tab.DASHBOARD} 
          onClick={() => setActiveTab(Tab.DASHBOARD)} 
          icon={<LayoutDashboard size={20} />} 
          label="Dashboard" 
        />

        <div className="w-8 h-[1px] bg-slate-800 my-1"></div>

        <NavButton 
          active={isSidePaneOpen} 
          onClick={() => setIsSidePaneOpen(!isSidePaneOpen)} 
          icon={<FolderClosed size={20} />} 
          label="Explorer" 
        />

        <NavButton 
          active={activeTab === Tab.CHAT} 
          onClick={() => setActiveTab(Tab.CHAT)} 
          icon={<MessageSquare size={20} />} 
          label="Interact" 
        />
        
        <NavButton 
          active={activeTab === Tab.AGENTS} 
          onClick={() => setActiveTab(Tab.AGENTS)} 
          icon={<Bot size={20} />} 
          label="Agents" 
        />

        <NavButton 
          active={activeTab === Tab.VERSION_CONTROL} 
          onClick={() => setActiveTab(Tab.VERSION_CONTROL)} 
          icon={<GitBranch size={20} />} 
          label="Version Control" 
        />

        <NavButton 
          active={activeTab === Tab.MCP} 
          onClick={() => setActiveTab(Tab.MCP)} 
          icon={<Server size={20} />} 
          label="MCP Servers" 
        />

        <NavButton 
          active={activeTab === Tab.VISION} 
          onClick={() => setActiveTab(Tab.VISION)} 
          icon={<Image size={20} />} 
          label="Vision" 
        />

        <div className="mt-auto flex flex-col gap-4">
          <NavButton 
            active={activeTab === Tab.SETTINGS} 
            onClick={() => setActiveTab(Tab.SETTINGS)} 
            icon={<Settings size={20} />} 
            label="Settings" 
          />
        </div>
      </div>

      {/* Side Pane (Explorer) */}
      {isSidePaneOpen && (
        <FileExplorer onFileSelect={handleFileOpen} onLog={addLog} />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900/50 backdrop-blur-sm relative">
        
        {/* Toggle Pane Button (floating style) */}
        {!isSidePaneOpen && (
           <button 
             onClick={() => setIsSidePaneOpen(true)}
             className="absolute left-0 top-1/2 -translate-y-1/2 bg-slate-800 border border-slate-700 border-l-0 p-1 rounded-r z-30 text-slate-400 hover:text-white transition-all"
           >
             <ChevronRight size={14} />
           </button>
        )}

        {/* Top Navigation Bar mimicking an IDE tab bar */}
        <div className="h-9 bg-slate-950 border-b border-slate-800 flex items-center px-1 shrink-0">
           {/* Dynamic Breadcrumbs/Tabs based on active view */}
           <div className="flex items-center gap-1 text-xs text-slate-500 px-3 font-mono">
             <span>opencode</span>
             <span>/</span>
             <span className="text-slate-300">{activeTab}</span>
             {activeAgent && activeTab === Tab.CHAT && (
                <>
                  <span>/</span>
                  <span className="text-pink-400">{activeAgent.name.toLowerCase().replace(' ', '_')}</span>
                </>
             )}
             {activeTab === Tab.EDITOR && currentFilePath && (
               <>
                 <span>/</span>
                 <span className="text-blue-400">{currentFilePath}</span>
               </>
             )}
           </div>
        </div>

        {/* Workspace Content */}
        <div className="flex-1 overflow-hidden relative">
          {renderContent()}
        </div>

        {/* Bottom Panel (Terminal) */}
        <div className="shrink-0">
          <Terminal 
            logs={logs} 
            isOpen={isTerminalOpen} 
            onToggle={() => setIsTerminalOpen(!isTerminalOpen)} 
          />
        </div>
        
        {/* Status Bar */}
        <div className="h-6 bg-slate-900 border-t border-slate-800 text-slate-400 text-[10px] flex items-center justify-between px-3 select-none font-mono">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-blue-400"><Code2 size={10} /> OPENCODE SERVER</span>
            <span className="flex items-center gap-1.5 hover:text-slate-200 cursor-pointer"><Plug size={10} /> MCP: Active (2)</span>
            <span className="flex items-center gap-1.5 hover:text-slate-200 cursor-pointer"><Bot size={10} /> Agents: {agents.length}</span>
            <span className="flex items-center gap-1.5 hover:text-slate-200 cursor-pointer"><FileCode size={10} /> Watcher: Active</span>
          </div>
          <div className="flex items-center gap-4">
            <span>bun v1.1.26</span>
            <span>uv 0.1.18</span>
            <span className="flex items-center gap-1.5 text-emerald-400">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
               System Online
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}

const NavButton = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) => (
  <button 
    onClick={onClick}
    className={`
      p-3 rounded-xl transition-all group relative
      ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'}
    `}
    title={label}
  >
    {icon}
    {/* Tooltip on hover */}
    <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-slate-900 border border-slate-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
      {label}
    </span>
  </button>
);

export default App;