import { GoogleGenAI, Chat, GenerateContentResponse, Content, Part, Type } from "@google/genai";
import { ChatMessage, MessageRole, LLMProvider, AppSettings, ChatMode } from "../types";

// --- Configuration Helper ---
const getGeminiClient = (key?: string) => new GoogleGenAI({ apiKey: key || process.env.API_KEY || '' });

// Helper to convert File to Base64
export const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve({
        inlineData: {
          data: base64String,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// --- Multi-Provider Types ---
export interface ChatSession {
  provider: LLMProvider;
  geminiChat?: Chat;
  systemInstruction?: string;
  mode: ChatMode;
}

export interface ChatResponse {
  text: string;
  sources?: string[];
}

// --- Generic Factory ---
export const createChatSession = (
  provider: LLMProvider,
  systemInstruction?: string, 
  history?: Content[],
  mode: ChatMode = 'standard',
  geminiKey?: string
): ChatSession => {
  const defaultInstruction = `You are OpenCode Assistant, a highly capable coding and general assistant integrated into the OpenCode Studio IDE. 
  
  Environment:
  - Runtime: Bun v1.1.26
  - Package Manager: uv
  - Tools: Git, GitHub CLI (gh)
  
  Be concise, technical, and helpful.`;

  const instruction = systemInstruction || defaultInstruction;

  if (provider === 'gemini') {
    const ai = getGeminiClient(geminiKey);
    
    // Determine Model and Config based on Mode
    let modelName = 'gemini-3-pro-preview';
    let config: any = { systemInstruction: instruction };

    switch (mode) {
      case 'thinking':
        modelName = 'gemini-3-pro-preview';
        config.thinkingConfig = { thinkingBudget: 32768 };
        // config.maxOutputTokens should NOT be set when using thinkingBudget
        break;
      case 'fast':
        modelName = 'gemini-2.5-flash-lite'; // or 'gemini-flash-lite-latest'
        break;
      case 'search':
        modelName = 'gemini-3-flash-preview';
        config.tools = [{ googleSearch: {} }];
        break;
      case 'standard':
      default:
        modelName = 'gemini-3-pro-preview';
        break;
    }

    return {
      provider: 'gemini',
      mode,
      geminiChat: ai.chats.create({
        model: modelName,
        history: history,
        config: config
      }),
      systemInstruction: instruction
    };
  }

  // For Stateless providers (Anthropic/OpenRouter), we just store the config
  return {
    provider,
    mode,
    systemInstruction: instruction
  };
};

// --- Generic Send Message ---
export const sendMessage = async (
  session: ChatSession, 
  message: string, 
  history: ChatMessage[],
  config: AppSettings
): Promise<ChatResponse> => {
  
  switch (session.provider) {
    case 'gemini':
      if (!session.geminiChat) throw new Error("Gemini chat session not initialized");
      try {
        const result: GenerateContentResponse = await session.geminiChat.sendMessage({ message });
        
        // Extract Grounding Metadata (Search Sources)
        let sources: string[] = [];
        if (result.candidates?.[0]?.groundingMetadata?.groundingChunks) {
           sources = result.candidates[0].groundingMetadata.groundingChunks
             .map((c: any) => c.web?.uri)
             .filter((uri: string) => !!uri);
        }

        return {
          text: result.text || "No response text generated.",
          sources: sources.length > 0 ? sources : undefined
        };
      } catch (error) {
        console.error("Gemini Error:", error);
        throw error;
      }

    case 'openrouter':
      const orText = await callOpenRouter(message, history, session.systemInstruction || '', config);
      return { text: orText };

    case 'anthropic':
      const antText = await callAnthropic(message, history, session.systemInstruction || '', config);
      return { text: antText };

    default:
      throw new Error(`Provider ${session.provider} not supported`);
  }
};

// --- Provider Implementations ---

async function callOpenRouter(message: string, history: ChatMessage[], system: string, config: AppSettings): Promise<string> {
  const apiKey = config.apiKeys.openrouter || process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OpenRouter API Key not configured");

  // Format messages
  const messages = [
    { role: 'system', content: system },
    ...history.filter(m => m.role !== MessageRole.SYSTEM).map(m => ({
      role: m.role === MessageRole.USER ? 'user' : 'assistant',
      content: m.text
    })),
    { role: 'user', content: message }
  ];

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000", 
        "X-Title": "OpenCode Studio"
      },
      body: JSON.stringify({
        model: config.openRouterModel || "anthropic/claude-3.5-sonnet",
        messages: messages
      })
    });

    if (!response.ok) {
       const err = await response.text();
       throw new Error(`OpenRouter API Error: ${err}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "No response from OpenRouter.";
  } catch (e) {
    console.error("OpenRouter Call Failed:", e);
    throw e;
  }
}

async function callAnthropic(message: string, history: ChatMessage[], system: string, config: AppSettings): Promise<string> {
  const apiKey = config.apiKeys.anthropic || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Anthropic API Key not configured");

  // Format messages
  const messages = [
    ...history.filter(m => m.role !== MessageRole.SYSTEM).map(m => ({
      role: m.role === MessageRole.USER ? 'user' : 'assistant',
      content: m.text
    })),
    { role: 'user', content: message }
  ];

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: config.anthropicModel || "claude-3-5-sonnet-20240620",
        max_tokens: 4096,
        system: system,
        messages: messages
      })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Anthropic API Error: ${err}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || "No response from Anthropic.";
  } catch (e) {
    console.error("Anthropic Call Failed:", e);
    throw e;
  }
}

// --- Image Analysis (Generic) ---
export const analyzeImage = async (file: File, prompt: string): Promise<string> => {
  try {
    const ai = getGeminiClient();
    const imagePart = await fileToGenerativePart(file);
    const result = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          imagePart,
          { text: prompt || "Analyze this image in detail." }
        ]
      }
    });
    return result.text || "No analysis generated.";
  } catch (error) {
    console.error("Error analyzing image:", error);
    throw error;
  }
};

// --- Utilities ---
export const optimizePrompt = async (originalPrompt: string): Promise<string> => {
  if (!originalPrompt) return "";
  try {
    const ai = getGeminiClient();
    const result = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are an expert prompt engineer specificially for coding tasks. 
      Refine the following prompt to be more precise, technical, and optimized. 
      Return ONLY the optimized prompt text.

      Original: "${originalPrompt}"`
    });
    return result.text?.trim() || originalPrompt;
  } catch (error) {
    return originalPrompt;
  }
};

export const compactChatHistory = async (fullHistory: {role: string, text: string}[], turnsToKeep: number = 4): Promise<{summary: string, recent: any[]}> => {
  try {
    const ai = getGeminiClient();
    const turnsCount = fullHistory.length;
    const historyToSummarize = fullHistory.slice(0, Math.max(0, turnsCount - turnsToKeep));
    const recentTurns = fullHistory.slice(Math.max(0, turnsCount - turnsToKeep));

    if (historyToSummarize.length === 0) {
      return { summary: "No older context to summarize.", recent: recentTurns };
    }

    const historyText = historyToSummarize
      .map(m => `${m.role.toUpperCase()}: ${m.text}`)
      .join('\n');

    const result = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Summarize the following technical chat history into a concise, high-density context block. 
      Preserve key architectural decisions and errors.

      Chat History:
      ${historyText}`
    });
    
    return { 
      summary: result.text?.trim() || "Context summarization failed.",
      recent: recentTurns
    };
  } catch (error) {
    console.error("Error compacting context:", error);
    throw error;
  }
};

export const fetchRelevantContext = async (userQuery: string): Promise<{ context: string; sources: string[] }> => {
  try {
    // Placeholder for actual RAG implementation
    return { context: "", sources: [] };
  } catch (e) {
    return { context: "", sources: [] };
  }
};

export const generateCommitMessage = async (diff: string): Promise<string> => {
  if (!diff || diff.length < 5) return "chore: update files";
  
  try {
     const ai = getGeminiClient();
     const result = await ai.models.generateContent({
         model: 'gemini-3-flash-preview',
         contents: `You are Zagi, an intelligent git assistant. 
         Generate a concise, conventional commit message based on the following git diff.
         
         Format: <type>(<scope>): <subject>
         
         [optional body]
         
         Rules:
         - Types: feat, fix, docs, style, refactor, test, chore, perf, ci, build.
         - Subject: Imperative mood, under 50 chars.
         - Body: Explain *what* and *why* (not how).
         - Return ONLY the message (no markdown blocks).
         
         Diff:
         ${diff.substring(0, 15000)}`
     });
     return result.text?.trim() || "chore: update files";
  } catch (error) {
     console.error("Failed to generate commit message:", error);
     return "chore: update files";
  }
};

export const generatePrDescription = async (diff: string, branchName: string): Promise<string> => {
  if (!diff || diff.length < 5) return "# New Pull Request\n\n- Updates";
  
  try {
     const ai = getGeminiClient();
     const result = await ai.models.generateContent({
         model: 'gemini-3-pro-preview',
         contents: `You are Zagi, a GitHub assistant.
         Generate a comprehensive Pull Request description for the branch '${branchName}'.
         
         Structure:
         # Title (Conventional Commit style)
         
         ## Description
         [Summary of changes]
         
         ## Key Changes
         - [Bullet points]
         
         ## Type of Change
         - [ ] Bug fix
         - [ ] New feature
         - [ ] Breaking change
         
         Diff:
         ${diff.substring(0, 20000)}`
     });
     return result.text?.trim() || "# PR Description";
  } catch (error) {
     console.error("Failed to generate PR description:", error);
     return "# PR Description\n\nFailed to generate content.";
  }
};

export const generateCodeReview = async (diff: string): Promise<string> => {
  if (!diff || diff.length < 5) return "No changes to review.";
  
  try {
     const ai = getGeminiClient();
     const result = await ai.models.generateContent({
         model: 'gemini-3-pro-preview',
         contents: `You are Zagi, a senior code reviewer. 
         Review the following git diff. Be critical but constructive.
         
         Check for:
         1. Bugs & Edge cases
         2. Security vulnerabilities
         3. Performance issues
         4. TypeScript/Code style best practices
         
         Output Format (Markdown):
         ## Zagi Code Review 🧐
         
         **Summary**: [One sentence opinion]
         
         - 🔴 **Critical**: [Issues]
         - 🟡 **Warning**: [Issues]
         - 🔵 **Suggestion**: [Issues]
         - 🟢 **Good**: [Positive feedback]
         
         Diff:
         ${diff.substring(0, 20000)}`
     });
     return result.text?.trim() || "Review failed.";
  } catch (error) {
     console.error("Failed to generate review:", error);
     return "Review failed.";
  }
};

export const resolveMergeConflict = async (fileContent: string): Promise<string> => {
  if (!fileContent.includes('<<<<<<<')) return fileContent;

  try {
     const ai = getGeminiClient();
     const result = await ai.models.generateContent({
         model: 'gemini-3-pro-preview',
         contents: `You are an expert git merge conflict resolver.
         The following text contains standard git conflict markers (<<<<<<<, =======, >>>>>>>).
         
         Task:
         1. Analyze the conflicting changes (Current Change vs Incoming Change).
         2. Intelligently merge them, preserving the intent of both sides if possible, or choosing the most logical change for code correctness.
         3. Return ONLY the resolved code content. Do not return markdown formatting or explanations.
         
         File Content:
         ${fileContent}`
     });
     
     let text = result.text?.trim() || fileContent;
     // Cleanup potential markdown wrapping
     if (text.startsWith('```')) {
        const lines = text.split('\n');
        // Remove first line (```lang)
        lines.shift();
        // Remove last line (```)
        if (lines[lines.length-1].trim() === '```') lines.pop();
        text = lines.join('\n');
     }
     return text;
  } catch (error) {
     console.error("Failed to resolve conflict:", error);
     throw error;
  }
};

// --- JSON Healing Utility ---
export const repairJson = (text: string): any => {
  // 1. Extract JSON substring if markdown code block exists
  const jsonBlockRegex = /```json\n([\s\S]*?)\n```/;
  const match = text.match(jsonBlockRegex);
  let jsonString = match ? match[1] : text;

  // 2. Simple cleanup
  jsonString = jsonString.trim();

  try {
    return JSON.parse(jsonString);
  } catch (e) {
    // 3. Attempt to fix truncation or formatting
    // Basic stack balancing for braces/brackets
    const stack = [];
    let inString = false;
    let escaped = false;
    let newString = "";
    
    // We rebuild the string to stop at the first structural error if possible, 
    // or just assume it's truncated.
    for (let char of jsonString) {
        if (char === '"' && !escaped) inString = !inString;
        
        if (!inString) {
            if (char === '{' || char === '[') stack.push(char);
            if (char === '}') {
                if (stack.length > 0 && stack[stack.length-1] === '{') stack.pop();
                else break; // Error in structure
            }
            if (char === ']') {
                if (stack.length > 0 && stack[stack.length-1] === '[') stack.pop();
                else break; // Error in structure
            }
        }
        
        escaped = (char === '\\' && !escaped);
        newString += char;
    }
    
    // Append missing closures
    while (stack.length > 0) {
        const op = stack.pop();
        if (op === '{') newString += '}';
        if (op === '[') newString += ']';
    }
    
    try {
        return JSON.parse(newString);
    } catch (e2) {
        return null; // Could not heal
    }
  }
};