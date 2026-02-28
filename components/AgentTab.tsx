import React, { useState } from 'react';
import { Agent } from '../types';
import { Bot, Plus, Trash2, Edit2, Zap, Save, X, Check, Tag } from 'lucide-react';

interface AgentTabProps {
  agents: Agent[];
  setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
  onLog: (message: string, level: 'info' | 'warn' | 'error' | 'success') => void;
  onSelectAgent: (agent: Agent) => void;
}

const COMMON_CAPABILITIES = [
  'coding', 'debugging', 'architecture', 'security', 'testing', 
  'qa', 'documentation', 'python', 'javascript', 'typescript', 
  'react', 'node.js', 'sql', 'git', 'refactoring', 'analysis',
  'design', 'frontend', 'backend', 'api'
];

const AgentTab: React.FC<AgentTabProps> = ({ agents, setAgents, onLog, onSelectAgent }) => {
  const [isCreating, setIsCreating] = useState(false);
  
  // New Agent State
  const [newAgent, setNewAgent] = useState<Partial<Agent>>({
    model: 'gemini-3-pro-preview',
    systemInstruction: '',
    capabilities: []
  });
  const [newCapabilityInput, setNewCapabilityInput] = useState('');

  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Agent>>({});
  const [editCapabilityInput, setEditCapabilityInput] = useState('');

  const handleCreate = () => {
    if (!newAgent.name) return;
    
    const agent: Agent = {
      id: Date.now().toString(),
      name: newAgent.name,
      model: newAgent.model || 'gemini-3-pro-preview',
      systemInstruction: newAgent.systemInstruction || 'You are a helpful assistant.',
      capabilities: newAgent.capabilities || []
    };
    
    setAgents([...agents, agent]);
    setIsCreating(false);
    setNewAgent({ model: 'gemini-3-pro-preview', systemInstruction: '', capabilities: [] });
    setNewCapabilityInput('');
    onLog(`Created new agent: ${agent.name}`, 'success');
  };

  const deleteAgent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this agent configuration?')) {
      setAgents(prev => prev.filter(a => a.id !== id));
      onLog('Agent deleted.', 'warn');
    }
  };

  const startEditing = (agent: Agent, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(agent.id);
    setEditForm({ ...agent });
    setEditCapabilityInput('');
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditForm({});
    setEditCapabilityInput('');
  };

  const saveEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editForm.name || !editingId) return;

    setAgents(prev => prev.map(a => 
      a.id === editingId ? { ...a, ...editForm } as Agent : a
    ));
    
    onLog(`Updated agent: ${editForm.name}`, 'success');
    setEditingId(null);
    setEditForm({});
    setEditCapabilityInput('');
  };

  // --- Capability Management Helpers ---

  const handleAddCapability = (type: 'create' | 'edit') => {
    const input = type === 'create' ? newCapabilityInput : editCapabilityInput;
    const setInput = type === 'create' ? setNewCapabilityInput : setEditCapabilityInput;
    const form = type === 'create' ? newAgent : editForm;
    const setForm = type === 'create' ? setNewAgent : setEditForm;

    const trimmed = input.trim();
    if (!trimmed) return;

    const currentCaps = form.capabilities || [];
    if (!currentCaps.includes(trimmed)) {
        setForm({ ...form, capabilities: [...currentCaps, trimmed] });
    }
    setInput('');
  };

  const removeCapability = (type: 'create' | 'edit', capToRemove: string) => {
    const form = type === 'create' ? newAgent : editForm;
    const setForm = type === 'create' ? setNewAgent : setEditForm;
    
    const currentCaps = form.capabilities || [];
    setForm({ ...form, capabilities: currentCaps.filter(c => c !== capToRemove) });
  };

  const CapabilityInput = ({ 
    inputValue, 
    setInputValue, 
    onAdd, 
    capabilities, 
    onRemove 
  }: { 
    inputValue: string, 
    setInputValue: (v: string) => void, 
    onAdd: () => void, 
    capabilities: string[], 
    onRemove: (c: string) => void 
  }) => (
    <div className="space-y-2">
       <div className="flex flex-wrap gap-2 mb-2">
          {capabilities.map(cap => (
              <span key={cap} className="bg-blue-900/30 text-blue-300 border border-blue-700/50 px-2 py-1 rounded text-xs flex items-center gap-1">
                  {cap}
                  <button onClick={() => onRemove(cap)} className="hover:text-white"><X size={12} /></button>
              </span>
          ))}
       </div>
       <div className="flex gap-2">
          <input 
            list="capabilities-suggestions"
            type="text" 
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onAdd()}
            className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none"
            placeholder="Add capability (e.g. coding)"
          />
          <button onClick={onAdd} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded">
             <Plus size={16} />
          </button>
       </div>
       <datalist id="capabilities-suggestions">
          {COMMON_CAPABILITIES.map(c => <option key={c} value={c} />)}
       </datalist>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="h-12 border-b border-slate-700 flex items-center justify-between px-6 bg-slate-800/50 shrink-0">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Bot size={18} className="text-pink-400" />
          AGENTS & SKILLS
        </h2>
        <button 
          onClick={() => setIsCreating(!isCreating)}
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1 transition-colors"
        >
          <Plus size={14} /> New Agent
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        
        {isCreating && (
          <div className="mb-6 bg-slate-800 border border-slate-700 rounded-lg p-4 animate-in fade-in slide-in-from-top-4">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Define New Agent</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Agent Name</label>
                <input 
                  type="text" 
                  value={newAgent.name || ''}
                  onChange={e => setNewAgent({...newAgent, name: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none"
                  placeholder="e.g., Python Expert"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">System Instruction (Skill Definition)</label>
                <textarea 
                  value={newAgent.systemInstruction || ''}
                  onChange={e => setNewAgent({...newAgent, systemInstruction: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm font-mono focus:border-blue-500 outline-none h-24 resize-none"
                  placeholder="Define the agent's personality, context, and rules..."
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Capabilities</label>
                <CapabilityInput 
                    inputValue={newCapabilityInput}
                    setInputValue={setNewCapabilityInput}
                    onAdd={() => handleAddCapability('create')}
                    capabilities={newAgent.capabilities || []}
                    onRemove={(cap) => removeCapability('create', cap)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsCreating(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white">Cancel</button>
                <button onClick={handleCreate} className="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white text-xs rounded">Create Agent</button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map(agent => (
            <div 
              key={agent.id} 
              onClick={() => !editingId && onSelectAgent(agent)}
              className={`
                bg-slate-800 border rounded-xl p-5 transition-all group
                ${editingId === agent.id ? 'border-blue-500 shadow-lg ring-1 ring-blue-500/20' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/80 cursor-pointer'}
              `}
            >
              {editingId === agent.id ? (
                // Edit Mode
                <div className="space-y-3" onClick={e => e.stopPropagation()}>
                   <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Editing Agent</div>
                      <div className="flex gap-1">
                         <button onClick={saveEdit} className="p-1 hover:bg-emerald-500/20 text-emerald-400 rounded"><Check size={16} /></button>
                         <button onClick={cancelEditing} className="p-1 hover:bg-red-500/20 text-red-400 rounded"><X size={16} /></button>
                      </div>
                   </div>
                   <div>
                      <label className="block text-[10px] text-slate-500 mb-1">Name</label>
                      <input 
                        type="text" 
                        value={editForm.name || ''}
                        onChange={e => setEditForm({...editForm, name: e.target.value})}
                        className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 focus:border-blue-500 outline-none font-semibold"
                      />
                   </div>
                   <div>
                      <label className="block text-[10px] text-slate-500 mb-1">Instructions</label>
                      <textarea 
                        value={editForm.systemInstruction || ''}
                        onChange={e => setEditForm({...editForm, systemInstruction: e.target.value})}
                        className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300 font-mono focus:border-blue-500 outline-none h-24 resize-none"
                      />
                   </div>
                   <div>
                      <label className="block text-[10px] text-slate-500 mb-1">Capabilities</label>
                      <CapabilityInput 
                        inputValue={editCapabilityInput}
                        setInputValue={setEditCapabilityInput}
                        onAdd={() => handleAddCapability('edit')}
                        capabilities={editForm.capabilities || []}
                        onRemove={(cap) => removeCapability('edit', cap)}
                      />
                   </div>
                </div>
              ) : (
                // View Mode
                <>
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-400">
                      <Bot size={20} />
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => startEditing(agent, e)}
                        className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
                        title="Edit Agent"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button 
                        onClick={(e) => deleteAgent(agent.id, e)}
                        className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400"
                        title="Delete Agent"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  
                  <h3 className="font-semibold text-slate-200 mb-1">{agent.name}</h3>
                  <p className="text-xs text-slate-500 line-clamp-3 h-10 mb-4">{agent.systemInstruction}</p>
                  
                  <div className="flex flex-wrap gap-1 mb-3">
                    {agent.capabilities && agent.capabilities.map((cap, idx) => (
                      <span key={idx} className="px-1.5 py-0.5 rounded-md bg-slate-700 text-[10px] text-slate-300 border border-slate-600">
                        {cap}
                      </span>
                    ))}
                    {(!agent.capabilities || agent.capabilities.length === 0) && (
                      <span className="text-[10px] text-slate-600 italic">No capabilities defined</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-auto pt-2 border-t border-slate-700/50">
                    <Zap size={10} className="text-yellow-500" />
                    <span>{agent.model}</span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AgentTab;