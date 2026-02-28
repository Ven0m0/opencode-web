# GitHub Copilot Instructions — OpenCode Studio

## Commands

```bash
bun install          # install dependencies
bun run dev          # start Vite dev server (port 3000, hot-reload)
bun run server.ts    # start Bun API + WebSocket server
bun run build        # production build → dist/
bun run preview      # serve dist/ locally
bun tsc --noEmit     # type-check (no emit)
docker compose up -d --build   # build + start Docker containers
```

## Conventions

### Language & Tooling
- TypeScript (ES2022, `moduleResolution: bundler`, `isolatedModules: true`)
- React 19 with functional components and hooks only
- Tailwind CSS utility classes; no CSS files or inline styles
- Path alias `@/` resolves to the project root
- Package manager: **Bun** (never npm or yarn)

### Naming
- Components and files: `PascalCase` (`ChatTab.tsx`, `FileExplorer.tsx`)
- Service files: `camelCase` (`geminiService.ts`)
- Interfaces: `PascalCase` (`ChatMessage`, `AppSettings`)
- Enums: `PascalCase` members in `SCREAMING_SNAKE` (`Tab.VERSION_CONTROL`)
- State variables: camelCase with verb prefix (`isLoading`, `activeTab`)
- Event handlers: `handle` prefix (`handleSend`, `handleFileSelect`)
- Callback props: `on` prefix (`onLogEntry`, `onTabChange`)

### Component Shape
```tsx
interface MyComponentProps {
  value: string;
  onAction: (v: string) => void;
}

const MyComponent: React.FC<MyComponentProps> = ({ value, onAction }) => {
  const [state, setState] = useState('');
  return <div className="bg-slate-900 text-slate-300">...</div>;
};

export default MyComponent;
```

### Import Order
1. React + hooks
2. Third-party libraries (`lucide-react`, etc.)
3. Internal components (`@/components/...`)
4. Types (`@/types`)
5. Services (`@/services/...`)

### Error Handling
- `try/catch` for all async operations
- Report errors via the `onLogEntry` prop with `level: 'error'`
- Provide user-visible fallback text; never silently swallow errors

### Styling
- Dark palette: `slate-900`/`slate-950` backgrounds, `slate-300` text, `indigo-500` accent
- Icons: `lucide-react` only, sizes `h-4 w-4` or `h-5 w-5`
- No inline `style` attributes

### State
- React hooks only (`useState`, `useEffect`, `useRef`)
- Persist settings via `localStorage`
- Real-time file events via WebSocket at `/ws`

## Key Files
- `@/types.ts` — all shared types and enums (add new ones here)
- `@/App.tsx` — root component, tab routing, global state
- `@/server.ts` — Bun HTTP + WebSocket server, API endpoints
- `@/services/geminiService.ts` — Gemini SDK wrapper
- `@/components/` — one file per tab/feature panel
