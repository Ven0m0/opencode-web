import React from 'react';
import { AppSettings, LLMProvider } from '../types';
import { Moon, Sun, Monitor, Layout, Save, Server, Key, Cpu, AlertTriangle, FileSearch } from 'lucide-react';

interface SettingsTabProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onLog: (message: string, level: 'info' | 'warn' | 'error' | 'success') => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ settings, onUpdateSettings, onLog }) => {
  
  const handleChange = (key: keyof AppSettings, value: any) => {
    const updated = { ...settings, [key]: value };
    onUpdateSettings(updated);
    localStorage.setItem('opencode_settings', JSON.stringify(updated));
  };

  const handleKeyChange = (provider: string, value: string) => {
    const updated = { 
        ...settings, 
        apiKeys: { ...settings.apiKeys, [provider]: value } 
    };
    onUpdateSettings(updated);
    localStorage.setItem('opencode_settings', JSON.stringify(updated));
  };

  const handleExtensionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      const exts = val.split(',').map(s => s.trim().replace('.', '')).filter(Boolean);
      handleChange('allowedExtensions', exts);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-y-auto">
      <div className="h-12 border-b border-slate-700 flex items-center px-6 bg-slate-800/50 shrink-0">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <SettingsIcon size={18} className="text-slate-400" />
          SETTINGS
        </h2>
      </div>

      <div className="p-8 max-w-3xl mx-auto w-full space-y-8">
        
        {/* AI Provider Section */}
        <section className="bg-slate-800 border border-slate-700 rounded-xl p-6">
           <h3 className="text-slate-200 font-semibold mb-6 flex items-center gap-2">
             <Cpu size={18} className="text-emerald-400" />
             AI Provider
           </h3>

           <div className="space-y-6">
              <div>
                 <label className="block text-sm text-slate-400 mb-3">Active Provider</label>
                 <div className="grid grid-cols-3 gap-4">
                    {(['gemini', 'openrouter', 'anthropic'] as LLMProvider[]).map(p => (
                        <button
                          key={p}
                          onClick={() => handleChange('activeProvider', p)}
                          className={`
                            flex flex-col items-center justify-center p-3 rounded-lg border transition-all
                            ${settings.activeProvider === p 
                                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' 
                                : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'}
                          `}
                        >
                           <span className="capitalize font-bold text-sm">{p}</span>
                        </button>
                    ))}
                 </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-700/50">
                 {settings.activeProvider === 'openrouter' && (
                    <div className="animate-in fade-in">
                       <div className="mb-4">
                          <label className="block text-xs text-slate-400 mb-1">OpenRouter Model</label>
                          <input 
                             type="text" 
                             value={settings.openRouterModel || 'anthropic/claude-3.5-sonnet'}
                             onChange={(e) => handleChange('openRouterModel', e.target.value)}
                             className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:border-blue-500 outline-none"
                             placeholder="anthropic/claude-3.5-sonnet"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Recommended: <span className="text-slate-400">anthropic/claude-3.5-sonnet</span> for coding.</p>
                       </div>
                       <div>
                          <label className="block text-xs text-slate-400 mb-1 flex items-center gap-2"><Key size={12}/> OpenRouter API Key</label>
                          <input 
                             type="password" 
                             value={settings.apiKeys.openrouter || ''}
                             onChange={(e) => handleKeyChange('openrouter', e.target.value)}
                             className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:border-blue-500 outline-none font-mono"
                             placeholder="sk-or-..."
                          />
                       </div>
                    </div>
                 )}

                 {settings.activeProvider === 'anthropic' && (
                    <div className="animate-in fade-in">
                       <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-3 mb-4 flex gap-2">
                          <AlertTriangle size={16} className="text-yellow-500 shrink-0" />
                          <p className="text-xs text-yellow-200/80">Using Anthropic directly from the browser may require a CORS proxy. OpenRouter is recommended for easier setup.</p>
                       </div>
                       <div className="mb-4">
                          <label className="block text-xs text-slate-400 mb-1">Anthropic Model</label>
                          <input 
                             type="text" 
                             value={settings.anthropicModel || 'claude-3-5-sonnet-20240620'}
                             onChange={(e) => handleChange('anthropicModel', e.target.value)}
                             className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:border-blue-500 outline-none"
                             placeholder="claude-3-5-sonnet-20240620"
                          />
                       </div>
                       <div>
                          <label className="block text-xs text-slate-400 mb-1 flex items-center gap-2"><Key size={12}/> Anthropic API Key</label>
                          <input 
                             type="password" 
                             value={settings.apiKeys.anthropic || ''}
                             onChange={(e) => handleKeyChange('anthropic', e.target.value)}
                             className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:border-blue-500 outline-none font-mono"
                             placeholder="sk-ant-..."
                          />
                       </div>
                    </div>
                 )}

                 {settings.activeProvider === 'gemini' && (
                    <div className="animate-in fade-in text-xs text-slate-500 italic">
                       Gemini API Key is managed via system environment variables (`process.env.API_KEY`).
                    </div>
                 )}
              </div>
           </div>
        </section>

        {/* Indexing Section */}
        <section className="bg-slate-800 border border-slate-700 rounded-xl p-6">
           <h3 className="text-slate-200 font-semibold mb-6 flex items-center gap-2">
             <FileSearch size={18} className="text-orange-400" />
             File Indexing
           </h3>
           <div>
              <label className="block text-sm text-slate-400 mb-2">Allowed File Extensions</label>
              <input 
                 type="text" 
                 value={settings.allowedExtensions?.join(', ') || ''}
                 onChange={handleExtensionChange}
                 className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:border-orange-500 outline-none font-mono"
                 placeholder="ts, js, json, md..."
              />
              <p className="text-xs text-slate-500 mt-2">
                 Comma-separated list of file extensions to include in the search index. Updating this will trigger a re-index on the server.
              </p>
           </div>
        </section>

        {/* Appearance Section */}
        <section className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h3 className="text-slate-200 font-semibold mb-6 flex items-center gap-2">
            <Monitor size={18} className="text-blue-400" />
            Appearance
          </h3>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm text-slate-400 mb-3">Theme</label>
              <div className="flex gap-4">
                <button
                  onClick={() => handleChange('theme', 'dark')}
                  className={`flex-1 p-4 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                    settings.theme === 'dark' 
                      ? 'bg-slate-700 border-blue-500 text-white shadow-md' 
                      : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600'
                  }`}
                >
                  <Moon size={24} />
                  <span className="text-sm font-medium">Dark Mode</span>
                </button>
                <button
                  onClick={() => handleChange('theme', 'light')}
                  className={`flex-1 p-4 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                    settings.theme === 'light' 
                      ? 'bg-slate-100 border-blue-500 text-slate-900 shadow-md' 
                      : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600'
                  }`}
                >
                  <Sun size={24} />
                  <span className="text-sm font-medium">Light Mode</span>
                </button>
              </div>
            </div>

            <div>
               <label className="block text-sm text-slate-400 mb-3">Font Family</label>
               <div className="grid grid-cols-3 gap-2">
                 {['Inter', 'Roboto', 'System'].map((font) => (
                   <button
                    key={font}
                    onClick={() => handleChange('fontFamily', font)}
                    className={`px-3 py-2 text-sm rounded border transition-colors ${
                      settings.fontFamily === font
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                   >
                     {font}
                   </button>
                 ))}
               </div>
            </div>
          </div>
        </section>

        {/* Editor Settings */}
        <section className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h3 className="text-slate-200 font-semibold mb-6 flex items-center gap-2">
            <Layout size={18} className="text-purple-400" />
            Editor Defaults
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
              <div className="flex flex-col">
                <span className="text-slate-200 text-sm font-medium">Word Wrap</span>
                <span className="text-slate-500 text-xs">Wrap long lines in chat and code blocks</span>
              </div>
              <Toggle 
                checked={settings.wordWrap} 
                onChange={(v) => handleChange('wordWrap', v)} 
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
              <div className="flex flex-col">
                <span className="text-slate-200 text-sm font-medium">Show Line Numbers</span>
                <span className="text-slate-500 text-xs">Display line numbers in code views</span>
              </div>
              <Toggle 
                checked={settings.showLineNumbers} 
                onChange={(v) => handleChange('showLineNumbers', v)} 
              />
            </div>
          </div>
        </section>
        
        <div className="flex justify-end">
          <div className="flex items-center gap-2 text-emerald-500 text-sm opacity-80">
            <Save size={14} />
            <span>Settings auto-saved</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsIcon = ({ size, className }: { size: number, className?: string }) => (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
);

const Toggle = ({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`w-11 h-6 rounded-full relative transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-700'}`}
  >
    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'left-6' : 'left-1'}`}></div>
  </button>
);

export default SettingsTab;