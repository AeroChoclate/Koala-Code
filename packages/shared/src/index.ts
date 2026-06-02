import { z } from 'zod';

export const AIProviderSchema = z.enum(['anthropic', 'openai', 'gemini', 'bedrock', 'ollama', 'openrouter']);
export type AIProvider = z.infer<typeof AIProviderSchema>;

export const AgentModeSchema = z.enum(['code', 'architect', 'ask', 'debug', 'orchestrator']);
export type AgentMode = z.infer<typeof AgentModeSchema>;

export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'claude-3-opus-20240229': 200000,
  'claude-3-sonnet-20240229': 200000,
  'claude-3.5-sonnet': 200000,
  'claude-3-haiku-20240307': 200000,
  'gpt-4-turbo': 128000,
  'gpt-4o': 128000,
  'gpt-4': 8192,
  'gpt-3.5-turbo': 16385,
  'gemini-pro': 32768,
  'gemini-1.5-pro': 1000000,
  'gemini-1.5-flash': 1000000,
};

export function getModelContextLimit(model: string): number {
  const normalizedModel = model.toLowerCase();
  
  for (const [key, limit] of Object.entries(MODEL_CONTEXT_LIMITS)) {
    if (normalizedModel.includes(key.toLowerCase())) {
      return limit;
    }
  }
  
  return 128000;
}

export function estimateTokenCount(text: string): number {
  const words = text.split(/\s+/).length;
  const characters = text.length;
  const estimatedTokens = Math.ceil(characters / 4);
  return Math.max(estimatedTokens, words);
}

export interface LLMConfig {
  provider: AIProvider;
  model: string;
  apiKey?: string;
}

export const ExtensionSettingsSchema = z.object({
  api: z.object({
    provider: AIProviderSchema.default('openrouter'),
    model: z.string().default(''),
    apiKey: z.string().optional(), // Kept here for typing, but at runtime it will come from SecretStorage
  }).default({
    provider: 'openrouter',
    model: '',
  }),
  mode: AgentModeSchema.default('code'),
  permissions: z.object({
    autoApproveFileRead: z.boolean().default(false),
    autoApproveFileWrite: z.boolean().default(false),
    autoApproveCommandExecution: z.boolean().default(false),
  }).default({
    autoApproveFileRead: false,
    autoApproveFileWrite: false,
    autoApproveCommandExecution: false,
  }),
  sessionSummary: z.object({
    enabled: z.boolean().default(false),
  }).default({
    enabled: false,
  }),
});
export type ExtensionSettings = z.infer<typeof ExtensionSettingsSchema>;

export type ChatMessage = {
  role: 'user' | 'agent';
  content: string;
};

export type StoredChatMessage = {
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredChatMessage[];
};

export type ConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessagePreview: string;
};

export type ContextInfo = {
  workspace?: string;
  activeFile?: string;
  branch?: string;
};

// Messages from Webview -> Extension Host
export type WebviewMessage =
  | { type: 'webview:ready' }
  | { type: 'chat:send'; value: string }
  | { type: 'chat:new' }
  | { type: 'chat:history:list' }
  | { type: 'chat:history:load'; id: string }
  | { type: 'chat:history:search'; query: string }
  | { type: 'chat:history:delete'; id: string }
  | { type: 'settings:get' }
  | { type: 'settings:save'; settings: Partial<ExtensionSettings> }
  | { type: 'permission:approve'; id: string }
  | { type: 'permission:deny'; id: string }
  | { type: 'session:summary:save'; content: string; conversationId: string }
  | { type: 'session:summary:dismiss' }
  | { type: 'message:feedback'; messageIndex: number; rating: 'positive' | 'negative' };

export type PermissionRequest = {
  id: string;
  tool: string;
  args: any;
  description: string;
};

// Messages from Extension Host -> Webview
export type HostMessage =
  | { type: 'chat:update'; messages: ChatMessage[] }
  | { type: 'chat:history:list-result'; conversations: ConversationSummary[] }
  | { type: 'chat:history:load-result'; conversation: Conversation }
  | { type: 'chat:history:search-result'; conversations: ConversationSummary[] }
  | { type: 'context:update'; context: ContextInfo }
  | { type: 'settings:update'; settings: ExtensionSettings }
  | { type: 'permission:ask'; request: PermissionRequest }
  | { type: 'agent:status'; status: 'idle' | 'working' | 'waiting'; startedAt?: number }
  | { type: 'session:summary:prompt'; conversationId: string; messages: ChatMessage[] }
  | { type: 'session:auto-summary:prompt'; conversationId: string; messages: ChatMessage[] };
