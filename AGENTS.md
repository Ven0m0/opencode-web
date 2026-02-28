# AGENTS.md — OpenCode Studio

> Guidance for AI assistants (Claude, Gemini, Copilot, etc.) working in this repository.

---

## Project

**OpenCode Studio** is a lightweight, browser-based AI-powered IDE interface.
It connects to large language model providers (Google Gemini, Anthropic, OpenRouter) and surfaces a full IDE experience — chat, file editor, version control, agent management, MCP server orchestration, and terminal logs — in a single-page React application backed by a Bun HTTP/WebSocket server.

| Attribute | Value |
|---|---|
| Primary language | TypeScript (strict ESNext + JSX) |
| Frontend framework | React 19 |
| Build tool | Vite 6 |
| Runtime / server | Bun |
| Styling | Tailwind CSS (CDN) |
| Containerisation | Docker + Cloudflare Tunnel |

---

## Structure

```
@/                          # Project root (alias for path resolution)
├── index.html              # HTML shell — loads Tailwind CDN, fonts, importmap
├── index.tsx               # React mount point (ReactDOM.createRoot)
├── App.tsx                 # Root component — tab routing, global state, layout
├── types.ts                # All shared TypeScript interfaces and enums
├── server.ts               # Bun HTTP + WebSocket server (API + file watcher)
├── vite.config.ts          # Vite config — React plugin, port 3000, @/ alias, env inject
├── tsconfig.json           # TypeScript config — ES2022, bundler resolution
├── package.json            # Dependencies; scripts: dev / build / preview
├── docker-compose.yml      # Two services: opencode (app) + cloudflared (tunnel)
├── Dockerfile              # Container image definition
├── .env                    # API_KEY + TUNNEL_TOKEN (not committed)
├── README.md               # Hosting guide (Docker + Cloudflare Tunnel)
│
├── @/components/           # Feature-scoped React tab components
│   ├── ChatTab.tsx         # Multi-provider LLM chat with mode switching
│   ├── AgentTab.tsx        # Agent definition + team orchestration
│   ├── VisionTab.tsx       # Image upload + vision analysis
│   ├── VersionControlTab.tsx # Full git/GitHub CLI UI
│   ├── EditorTab.tsx       # Monaco-style file editor
│   ├── FileExplorer.tsx    # Workspace file-tree browser
│   ├── DashboardTab.tsx    # Overview / quick-actions dashboard
│   ├── MCPServerTab.tsx    # MCP server lifecycle management
│   ├── SettingsTab.tsx     # Provider keys, model selection, UI prefs
│   └── Terminal.tsx        # In-app log/terminal viewer
│
├── @/services/
│   └── geminiService.ts    # Gemini SDK wrapper (streaming, thinking, search modes)
│
└── workspace/              # Mounted volume — user project files (hot-watched)
```

---

## Dev Workflow

### Prerequisites

- **Bun** ≥ 1.1.26 (`curl -fsSL https://bun.sh/install | bash`)
- **Docker** + Docker Compose (for containerised runs)
- A Google Gemini API key from [aistudio.google.com](https://aistudio.google.com/app/apikey)

### Local development (no Docker)

```bash
# 1. Install dependencies
bun install

# 2. Create environment file
cp .env.example .env          # or create manually:
echo "API_KEY=your_gemini_key" > .env
echo "GEMINI_API_KEY=your_gemini_key" >> .env

# 3. Start Vite dev server (hot-reload, port 3000)
bun run dev

# 4. In a separate terminal, start the Bun API server
bun run server.ts
```

### Docker (recommended for full feature set)

```bash
# Build and start all services (app + Cloudflare tunnel)
docker compose up -d

# View logs
docker compose logs -f opencode

# Stop
docker compose down

# Rebuild after code changes
docker compose up -d --build

# Force recreate (e.g., after env changes)
docker compose up -d --force-recreate
```

### Production build

```bash
bun run build     # outputs to dist/
bun run preview   # serve dist/ locally for verification
```

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `API_KEY` | Yes | Google Gemini API key (used by Docker / server.ts) |
| `GEMINI_API_KEY` | Yes | Same key, used by Vite `process.env` injection |
| `TUNNEL_TOKEN` | Optional | Cloudflare Zero Trust tunnel token for public access |

---

## Conventions

### Naming

| Construct | Convention | Example |
|---|---|---|
| React components | PascalCase | `ChatTab`, `FileExplorer` |
| Component files | PascalCase | `ChatTab.tsx`, `SettingsTab.tsx` |
| Service files | camelCase | `geminiService.ts` |
| TypeScript interfaces | PascalCase | `ChatMessage`, `AppSettings` |
| Enums | PascalCase | `Tab`, `MessageRole`, `LLMProvider` |
| Enum members | SCREAMING_SNAKE | `Tab.VERSION_CONTROL`, `MessageRole.USER` |
| React state | camelCase, verb prefix | `isLoading`, `activeTab`, `showLineNumbers` |
| Event handlers | `handle` prefix | `handleSend`, `handleFileSelect` |
| Callback props | `on` prefix | `onTabChange`, `onLogEntry` |

### Component structure

Every component follows this shape:

```tsx
// 1. React + library imports
import React, { useState, useEffect, useRef } from 'react';
import { IconName } from 'lucide-react';

// 2. Internal imports
import { SomeType } from '@/types';
import someService from '@/services/someService';

// 3. Props interface
interface ComponentNameProps {
  requiredProp: string;
  onCallback: (value: string) => void;
}

// 4. Component (React.FC with explicit props type)
const ComponentName: React.FC<ComponentNameProps> = ({ requiredProp, onCallback }) => {
  const [state, setState] = useState<string>('');

  useEffect(() => {
    // setup
    return () => { /* cleanup */ };
  }, [deps]);

  return (
    <div className="...tailwind classes...">
      {/* JSX */}
    </div>
  );
};

export default ComponentName;
```

### Import style

- Use the `@/` path alias for all project-internal imports (resolves to project root).
- Group imports: React → third-party libs → internal components → types → services.
- No barrel `index.ts` files; import directly from the source file.

### Error handling

- Wrap all async operations in `try/catch`.
- Log errors to the shared `LogEntry` system via the `onLogEntry` callback prop.
- Provide user-visible fallback text (e.g., `"No response generated"`); never silently swallow errors.
- Use `console.error` for development-time diagnostics only.

### State management

- React hooks only (`useState`, `useEffect`, `useRef`, `useCallback`).
- Persist user settings via `localStorage` (key: `opencode-settings`).
- Real-time file events via WebSocket (`ws://localhost:3000/ws`).
- No Redux, Zustand, or Context API — pass state down as props.

### Styling

- Tailwind CSS utility classes exclusively; no custom CSS files.
- Dark-theme palette: `slate-900` / `slate-950` backgrounds, `slate-700` borders, `slate-300` text.
- IDE chrome colours: `indigo-500` accent, `green-400` success, `red-400` error, `yellow-400` warning.
- Use `lucide-react` for all icons; match existing icon sizing (`h-4 w-4`, `h-5 w-5`).
- No inline `style` attributes — use Tailwind classes or `cn()` composition.

### TypeScript

- All types live in `@/types.ts`; add new shared types there.
- Prefer `interface` over `type` for object shapes; use `type` for unions/aliases.
- Avoid `any`; use `unknown` and narrow when the type is genuinely unknown.
- Target ES2022; `moduleResolution: bundler`; `isolatedModules: true`.

---

## Dependencies

| Package | Purpose |
|---|---|
| `react` / `react-dom` ^19 | UI rendering |
| `@google/genai` ^1.40 | Google Gemini SDK (streaming, function calling, search grounding) |
| `react-markdown` 9 | Render LLM markdown responses |
| `lucide-react` ^0.563 | Icon set |
| `vite` ^6 | Dev server + production bundler |
| `@vitejs/plugin-react` ^5 | Vite React/JSX transform |
| `typescript` ~5.8 | Type checking |
| `bun` ^1.3.9 | HTTP/WebSocket server runtime + package manager |

---

## Common Tasks

### Add a new tab / feature panel

1. Create `@/components/NewFeatureTab.tsx` following the component structure above.
2. Add an entry to the `Tab` enum in `@/types.ts`.
3. Register the tab in `App.tsx`:
   - Import the component.
   - Add an activity-bar icon button mapping to the new `Tab` value.
   - Add a `{activeTab === Tab.NEW_FEATURE && <NewFeatureTab ... />}` render block.

### Add a new API endpoint

1. Open `@/server.ts`.
2. Add a new `if (url.pathname === '/api/your-endpoint')` block inside the `Bun.serve` fetch handler.
3. Return a `new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })`.
4. Call it from the frontend with `fetch('/api/your-endpoint')`.

### Add a new LLM provider

1. Add the provider name to the `LLMProvider` union type in `@/types.ts`.
2. Create a service file `@/services/yourProviderService.ts` modelled on `geminiService.ts`.
3. Extend `SettingsTab.tsx` to expose the provider's API key field.
4. Wire the provider in `ChatTab.tsx` — add a branch in the send-message handler.

### Fix a bug

1. Identify the component/service from the tab/feature name.
2. Read the relevant file before editing.
3. Add a `LogEntry` with `level: 'error'` if the bug relates to a failed operation.
4. Keep the fix minimal; do not refactor surrounding code.

### Update dependencies

```bash
bun update                   # update all to latest satisfying semver ranges
bun update <package-name>    # update a specific package
bun add <package>@latest     # upgrade to latest major
```

Rebuild Docker image after any dependency change:

```bash
docker compose up -d --build
```

---

## CI/CD

No automated CI/CD pipeline is currently configured (no `.github/workflows/`).

Recommended additions when setting up:

```yaml
# Suggested: .github/workflows/ci.yml
on: [push, pull_request]
jobs:
  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun tsc --noEmit        # type check
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run build
```

**Deploy process (current):**

1. Push code to `main` / `master`.
2. SSH into host, pull latest, rebuild Docker image:
   ```bash
   git pull origin main
   docker compose up -d --build
   ```
3. Cloudflare Tunnel routes public traffic — no port forwarding required.

---

## Tool Preferences

| Category | Tool |
|---|---|
| Package manager | **Bun** (do not use npm or yarn) |
| Runtime (server) | **Bun** |
| Bundler | **Vite** |
| Type checker | `tsc --noEmit` via Bun |
| Formatter | None configured — match surrounding code style manually |
| Linter | None configured — use TypeScript strict mode as quality gate |
| Icons | **Lucide React** (never add a second icon library) |
| CSS | **Tailwind CSS** utility classes (no CSS-in-JS, no SCSS) |
| Container | **Docker Compose** (single `docker compose` command, no legacy `docker-compose`) |

---

## Server API Reference

The Bun server (`server.ts`) exposes these HTTP endpoints on port 3000:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/workspace` | Recursive workspace file tree |
| `GET` | `/api/workspace/file?path=` | Read file contents |
| `POST` | `/api/workspace/file` | Write file contents |
| `POST` | `/api/git` | Execute an allowlisted git command |
| `POST` | `/api/gh` | Execute an allowlisted `gh` CLI command |
| `GET` | `/api/indexing/config` | Get current search index config |
| `POST` | `/api/indexing/config` | Update search index allowed extensions |
| `GET` | `/api/search?q=` | Full-text search across indexed workspace files |
| `GET/WS` | `/ws` | WebSocket — push file-change events to frontend |

Git commands are allowlisted for security; arbitrary shell execution is not exposed.

---

## Workspace

The `./workspace/` directory is the user's project sandbox:

- Mounted as a Docker volume (`./workspace:/app/workspace`).
- Watched by a `fs.watch` recursive watcher in `server.ts`; changes broadcast via WebSocket.
- Indexed on startup and on file change (files ≤ 500 KB, configured extensions only).
- Edited live through the IDE's Editor and Version Control tabs.
- Persisted on the host — container restarts do not lose files.
