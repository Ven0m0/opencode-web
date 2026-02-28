
export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: Date;
  agentName?: string;
  contextSources?: string[];
  mode?: ChatMode;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export enum Tab {
  DASHBOARD = 'dashboard',
  CHAT = 'chat',
  AGENTS = 'agents',
  MCP = 'mcp',
  SETTINGS = 'settings',
  VISION = 'vision',
  EDITOR = 'editor',
  VERSION_CONTROL = 'version_control'
}

export interface WorkspaceFile {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modified?: Date;
  children?: WorkspaceFile[];
}

export interface MCPServer {
  id: string;
  name: string;
  transport: 'stdio' | 'sse';
  command: string;
  status: 'running' | 'stopped' | 'error';
  env?: Record<string, string>;
}

export interface Agent {
  id: string;
  name: string;
  model: string;
  systemInstruction: string;
  capabilities: string[];
}

export type LLMProvider = 'gemini' | 'anthropic' | 'openrouter';

export type ChatMode = 'standard' | 'thinking' | 'fast' | 'search';

export interface AppSettings {
  theme: 'dark' | 'light';
  fontFamily: 'Inter' | 'System' | 'Roboto';
  wordWrap: boolean;
  showLineNumbers: boolean;
  allowedExtensions: string[]; // For file indexing
  
  // AI Provider Settings
  activeProvider: LLMProvider;
  apiKeys: {
    gemini: string; // Loaded from env usually
    anthropic: string;
    openrouter: string;
  };
  openRouterModel: string; // e.g., "anthropic/claude-3.5-sonnet"
  anthropicModel: string; // e.g., "claude-3-5-sonnet-20240620"
}
