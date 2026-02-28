import React, { useState } from 'react';
import { MCPServer } from '../types';
import { Server, Plus, Play, Square, Terminal, Settings } from 'lucide-react';

interface MCPServerTabProps {
  onLog: (message: string, level: 'info' | 'warn' | 'error' | 'success') => void;
}

const MCPServerTab: React.FC<MCPServerTabProps> = ({ onLog }) => {
  const [servers, setServers] = useState<MCPServer[]>([
    {
      id: '1',
      name: 'filesystem-local',
      transport: 'stdio',
      command: 'uv run @modelcontextprotocol/server-filesystem ./workspace',
      status: 'running',
    },
    {
      id: '2',
      name: 'github-integration',
      transport: 'stdio',
      command: 'bun run @modelcontextprotocol/server-github',
      status: 'running', // Enabled by default now
    }
  ]);
  
  const [isAdding, setIsAdding] = useState(false);
  const [newServer, setNewServer] = useState<Partial<MCPServer>>({
    transport: 'stdio',
    command: 'uv run '
  });

  const toggleServer = (id: string) => {
    setServers(prev => prev.map(s => {
      if (s.id === id) {
        const newStatus = s.status === 'running' ? 'stopped' : 'running';
        onLog(`MCP Server '${s.name}' ${newStatus === 'running' ? 'started' : 'stopped'}.`, 'info');
        return { ...s, status: newStatus };
      }
      return s;
    }));
  };

  const handleAddServer = () => {
    if (!newServer.name || !newServer.command) return;
    
    const server: MCPServer = {
      id: Date.now().toString(),
      name: newServer.name,
      command: newServer.command,
      transport: newServer.transport as 'stdio' | 'sse',
      status: 'stopped'
    };
    
    setServers([...servers, server]);
    setIsAdding(false);
    setNewServer({ transport: 'stdio', command: 'uv run ' });
    onLog(`Added new MCP Server configuration: ${server.name}`, 'success');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="h-12 border-b border-slate-700 flex items-center justify-between px-6 bg-slate-800/50 shrink-0">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Server size={18} className="text-orange-400" />
          MCP SERVERS
        </h2>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1 transition-colors"
        >
          <Plus size={14} /> Add Server
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        
        {isAdding && (
          <div className="mb-6 bg-slate-800 border border-slate-700 rounded-lg p-4 animate-in fade-in slide-in-from-top-4">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Add New MCP Server</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Server Name</label>
                <input 
                  type="text" 
                  value={newServer.name || ''}
                  onChange={e => setNewServer({...newServer, name: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none"
                  placeholder="e.g., postgres-db"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Command (Use 'uv' or 'bun')</label>
                <div className="flex gap-2">
                   <div className="relative flex-1">
                      <Terminal size={14} className="absolute left-3 top-3 text-slate-500" />
                      <input 
                        type="text" 
                        value={newServer.command || ''}
                        onChange={e => setNewServer({...newServer, command: e.target.value})}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 pl-9 text-sm font-mono focus:border-blue-500 outline-none"
                        placeholder="uv run mcp-server-..."
                      />
                   </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setNewServer({...newServer, command: 'uv run '})} className="text-[10px] bg-slate-700 px-2 py-1 rounded text-slate-300 hover:text-white">uv run</button>
                  <button onClick={() => setNewServer({...newServer, command: 'bun run '})} className="text-[10px] bg-slate-700 px-2 py-1 rounded text-slate-300 hover:text-white">bun run</button>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => setIsAdding(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white">Cancel</button>
                <button onClick={handleAddServer} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded">Save Configuration</button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {servers.map(server => (
            <div key={server.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex items-center justify-between group hover:border-slate-600 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full ${server.status === 'running' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-600'}`}></div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-slate-200 text-sm">{server.name}</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-500 border border-slate-700 font-mono">{server.transport}</span>
                  </div>
                  <code className="text-[10px] text-slate-500 font-mono mt-1 block">{server.command}</code>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => toggleServer(server.id)}
                  className={`p-2 rounded-md transition-colors ${
                    server.status === 'running' 
                      ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' 
                      : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                  }`}
                  title={server.status === 'running' ? 'Stop Server' : 'Start Server'}
                >
                  {server.status === 'running' ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                </button>
                <button className="p-2 text-slate-500 hover:text-slate-300 transition-colors">
                  <Settings size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
        
        {servers.length === 0 && !isAdding && (
           <div className="text-center py-10 text-slate-500">
             <p>No MCP servers configured.</p>
             <p className="text-xs mt-2">Add a server to extend Gemini's capabilities with local tools.</p>
           </div>
        )}
      </div>
    </div>
  );
};

export default MCPServerTab;
