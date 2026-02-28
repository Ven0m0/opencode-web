import { watch, existsSync, mkdirSync, readdirSync, statSync, readFileSync, writeFileSync } from "fs";
import { join, relative, resolve } from "path";

// Fix for missing Bun types in environment
declare var Bun: any;

const PORT = 3000;
const WORKSPACE_DIR = resolve("./workspace");

// Ensure workspace directory exists
if (!existsSync(WORKSPACE_DIR)) {
  try {
    mkdirSync(WORKSPACE_DIR);
    console.log(`Created workspace directory at ${WORKSPACE_DIR}`);
  } catch (e) {
    console.error(`Failed to create workspace directory: ${e}`);
  }
}

// --- CONFIGURATION ---
let indexConfig = {
  allowedExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'md', 'txt', 'html', 'css', 'scss', 'py', 'java', 'c', 'cpp', 'h', 'sh', 'yml', 'yaml', 'toml', 'ini', 'xml', 'sql', 'env']
};

// --- SEARCH INDEXING SERVICE ---
interface FileIndexItem {
  path: string;
  name: string;
  content: string; // Lowercase content for search
  size: number;
  modified: string;
}

let searchIndex: FileIndexItem[] = [];

const isIndexable = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase();
  return indexConfig.allowedExtensions.includes(ext || '');
};

const indexFile = (fullPath: string) => {
  const relPath = relative(WORKSPACE_DIR, fullPath);
  
  // Remove existing entry if present (update)
  searchIndex = searchIndex.filter(i => i.path !== relPath);

  if (!existsSync(fullPath)) return; // Deleted

  try {
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return;
    if (stat.size > 500 * 1024) return; // Skip files > 500KB to save memory

    let content = '';
    if (isIndexable(fullPath)) {
       try {
         content = readFileSync(fullPath, 'utf-8').toLowerCase();
       } catch (e) {
         // Ignore read errors
       }
       
       searchIndex.push({
         path: relPath,
         name: relPath.split('/').pop() || '',
         content, // Content is stored lowercase
         size: stat.size,
         modified: stat.mtime.toISOString()
       });
    }
  } catch (e) {
    console.error(`[Indexer] Failed to index ${relPath}: ${e}`);
  }
};

const buildIndex = () => {
  console.log('[Indexer] Starting full workspace scan...');
  const start = Date.now();
  searchIndex = []; // Clear index
  
  const walk = (dir: string) => {
    try {
      const files = readdirSync(dir);
      for (const file of files) {
        if (file === '.git' || file === 'node_modules') continue; // Always ignore
        
        const fullPath = join(dir, file);
        try {
            const stat = statSync(fullPath);
            if (stat.isDirectory()) {
                walk(fullPath);
            } else {
                indexFile(fullPath);
            }
        } catch(e) {}
      }
    } catch(e) {}
  };
  
  walk(WORKSPACE_DIR);
  console.log(`[Indexer] Complete. Indexed ${searchIndex.length} files in ${Date.now() - start}ms`);
};

// Start initial indexing
setTimeout(buildIndex, 500);

console.log(`\n🚀 Starting OpenCode Studio Server...`);
console.log(`---------------------------------------------`);
console.log(`STATUS:`);
console.log(`- Port: ${PORT}`);
console.log(`- Runtime: Bun ${Bun.version}`);
console.log(`- API Key Injection: ${process.env.API_KEY ? '✅ Enabled' : '❌ Missing (Check .env)'}`);
console.log(`- File Watcher: Active on ${WORKSPACE_DIR}`);
console.log(`---------------------------------------------`);

const server = Bun.serve({
  port: PORT,
  // Allow connections from any interface (Docker requirement)
  hostname: "0.0.0.0", 
  async fetch(req: any, server: any) {
    const url = new URL(req.url);

    // WebSocket Upgrade
    if (url.pathname === "/ws") {
      if (server.upgrade(req)) {
        return undefined; // Handled by websocket handler
      }
      return new Response("WebSocket upgrade failed", { status: 500 });
    }

    // API: Indexing Configuration
    if (url.pathname === "/api/indexing/config") {
       if (req.method === "POST") {
         try {
           const body = await req.json();
           if (Array.isArray(body.allowedExtensions)) {
             indexConfig.allowedExtensions = body.allowedExtensions;
             // Trigger re-index
             setTimeout(buildIndex, 100);
             return new Response("Config updated and re-indexing started");
           }
         } catch(e) { return new Response("Invalid config", { status: 400 }); }
       }
       return new Response(JSON.stringify(indexConfig), { headers: { "Content-Type": "application/json" }});
    }

    // API: Git Execution
    if (url.pathname === "/api/git") {
        if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
        
        try {
            const body = await req.json();
            const { command, args } = body;
            
            // Expanded allowlist for full git support
            const allowedCommands = [
                'status', 'add', 'commit', 'push', 'diff', 'log', 
                'branch', 'checkout', 'pull', 'merge', 'fetch', 
                'remote', 'init', 'clone'
            ];
            
            if (!allowedCommands.includes(command)) {
                return new Response(`Command 'git ${command}' not allowed via API`, { status: 403 });
            }

            const cmdArgs = ['git', command, ...(args || [])];
            
            const proc = Bun.spawn(cmdArgs, {
                cwd: WORKSPACE_DIR,
                stdout: "pipe",
                stderr: "pipe",
            });

            const stdout = await new Response(proc.stdout).text();
            const stderr = await new Response(proc.stderr).text();
            const exitCode = await proc.exited;

            return new Response(JSON.stringify({ 
                stdout, 
                stderr, 
                exitCode 
            }), { headers: { "Content-Type": "application/json" } });

        } catch (e) {
            return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
        }
    }

    // API: GitHub CLI Execution
    if (url.pathname === "/api/gh") {
        if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
        
        try {
            const body = await req.json();
            const { command, args } = body;
            
            // Allowlist allowed gh commands
            const allowedCommands = ['issue', 'pr', 'repo', 'auth', 'browse', 'run', 'workflow'];
            
            if (!allowedCommands.includes(command)) {
                return new Response(`Command 'gh ${command}' not allowed via API`, { status: 403 });
            }

            const cmdArgs = ['gh', command, ...(args || [])];
            
            // Pass through current environment variables for GH_TOKEN if set
            const proc = Bun.spawn(cmdArgs, {
                cwd: WORKSPACE_DIR,
                stdout: "pipe",
                stderr: "pipe",
                env: { ...process.env, CLICOLOR: "0" } // Disable color codes in JSON output
            });

            const stdout = await new Response(proc.stdout).text();
            const stderr = await new Response(proc.stderr).text();
            const exitCode = await proc.exited;

            return new Response(JSON.stringify({ 
                stdout, 
                stderr, 
                exitCode 
            }), { headers: { "Content-Type": "application/json" } });

        } catch (e) {
            return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
        }
    }

    // API: Workspace File List
    if (url.pathname === "/api/workspace") {
      const getTree = (dir: string): any[] => {
        const entries = readdirSync(dir);
        return entries.map(name => {
          if (name === '.git' || name === 'node_modules') return null; // Hide internal dirs
          const fullPath = join(dir, name);
          const stat = statSync(fullPath);
          const isDirectory = stat.isDirectory();
          return {
            name,
            path: relative(WORKSPACE_DIR, fullPath),
            isDirectory,
            size: stat.size,
            modified: stat.mtime,
            children: isDirectory ? getTree(fullPath) : undefined
          };
        }).filter(Boolean).sort((a: any, b: any) => (b.isDirectory ? 1 : 0) - (a.isDirectory ? 1 : 0) || a.name.localeCompare(b.name));
      };

      try {
        const tree = getTree(WORKSPACE_DIR);
        return new Response(JSON.stringify(tree), { headers: { "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    // API: File Content (Read/Write)
    if (url.pathname === "/api/workspace/file") {
      const filePathParam = url.searchParams.get("path");
      if (!filePathParam) return new Response("Path required", { status: 400 });
      
      const fullPath = join(WORKSPACE_DIR, filePathParam);
      // Security check: ensure path is within workspace
      if (!fullPath.startsWith(WORKSPACE_DIR)) {
        return new Response("Unauthorized path access", { status: 403 });
      }

      if (req.method === "GET") {
        try {
          const content = readFileSync(fullPath);
          return new Response(content);
        } catch (e) {
          return new Response("File not found", { status: 404 });
        }
      }

      if (req.method === "POST") {
        try {
          // Use arrayBuffer to support binary files (images, etc.)
          const buffer = await req.arrayBuffer();
          writeFileSync(fullPath, new Uint8Array(buffer));
          // If we write a file, index it immediately if permitted
          if (isIndexable(fullPath)) {
              indexFile(fullPath);
          }
          return new Response("Saved");
        } catch (e) {
          return new Response("Failed to save", { status: 500 });
        }
      }
    }

    // API: File Search (Optimized with In-Memory Index)
    if (url.pathname === "/api/search") {
      const query = url.searchParams.get("q")?.toLowerCase();
      if (!query) {
        return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });
      }

      try {
        // Fast in-memory search
        const results = searchIndex.filter(item => 
          item.name.toLowerCase().includes(query) || 
          item.content.includes(query)
        ).map(item => ({
          name: item.name,
          path: item.path,
          size: item.size,
          modified: item.modified,
          matchType: item.name.toLowerCase().includes(query) ? 'filename' : 'content'
        })).slice(0, 50); // Limit to top 50 matches

        return new Response(JSON.stringify(results), { 
          headers: { "Content-Type": "application/json" } 
        });
      } catch (e) {
        console.error("Search error:", e);
        return new Response(JSON.stringify([]), { status: 500 });
      }
    }
    
    // Serve HTML
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(Bun.file("index.html"), {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Serve Bundled Application
    if (url.pathname === "/index.js") {
      try {
        const result = await Bun.build({
          entrypoints: ["./index.tsx"],
          external: ["react", "react-dom/client", "lucide-react", "@google/genai"],
          minify: false, // Keep readable for debugging
          define: {
            "process.env.API_KEY": JSON.stringify(process.env.API_KEY || ""),
            "process.env.ANTHROPIC_API_KEY": JSON.stringify(process.env.ANTHROPIC_API_KEY || ""),
            "process.env.OPENROUTER_API_KEY": JSON.stringify(process.env.OPENROUTER_API_KEY || ""),
          },
        });

        if (result.success) {
           return new Response(result.outputs[0], {
             headers: { "Content-Type": "application/javascript" },
           });
        } else {
           console.error("Build failed:", result.logs);
           return new Response("Build Failed: " + JSON.stringify(result.logs), { status: 500 });
        }
      } catch (e) {
        return new Response("Internal Server Error: " + e, { status: 500 });
      }
    }
    
    // Serve Static Assets (if any are added later)
    const staticFile = Bun.file("." + url.pathname);
    if (await staticFile.exists()) {
      return new Response(staticFile);
    }

    return new Response("Not Found", { status: 404 });
  },
  websocket: {
    open(ws: any) {
      ws.subscribe("workspace-updates");
    },
    message(ws: any, message: any) {
      // Handle incoming messages if needed
    },
    close(ws: any) {
      ws.unsubscribe("workspace-updates");
    },
  },
});

// Watch for file changes in workspace
try {
  watch(WORKSPACE_DIR, { recursive: true }, (event, filename) => {
    if (filename && filename !== '.git' && !filename.includes('.git/')) {
      const fullPath = join(WORKSPACE_DIR, filename);
      
      // Update Index
      setTimeout(() => {
        indexFile(fullPath);
      }, 200);

      const msg = JSON.stringify({
        type: 'file_change',
        event,
        path: filename,
        timestamp: new Date().toISOString()
      });
      server.publish("workspace-updates", msg);
    }
  });
} catch (e) {
  console.error("Error setting up file watcher:", e);
}

console.log(`Server is running! Access it at http://localhost:${PORT}`);