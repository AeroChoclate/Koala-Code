import { z } from 'zod';

export const AIProviderSchema = z.enum(['anthropic', 'openai', 'gemini', 'bedrock', 'ollama', 'openrouter']);
export type AIProvider = z.infer<typeof AIProviderSchema>;

export const AgentModeSchema = z.enum(['code', 'architect', 'ask', 'debug', 'orchestrator']);
export type AgentMode = z.infer<typeof AgentModeSchema>;

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
});
export type ExtensionSettings = z.infer<typeof ExtensionSettingsSchema>;

export type ChatMessage = {
  role: 'user' | 'agent';
  content: string;
};

// Messages from Webview -> Extension Host
export type WebviewMessage =
  | { type: 'webview:ready' }
  | { type: 'chat:send'; value: string }
  | { type: 'settings:get' }
  | { type: 'settings:save'; settings: Partial<ExtensionSettings> }
  | { type: 'permission:approve'; id: string }
  | { type: 'permission:deny'; id: string };

export type PermissionRequest = {
  id: string;
  tool: string;
  args: any;
  description: string;
};

// Messages from Extension Host -> Webview
export type HostMessage =
  | { type: 'chat:update'; messages: ChatMessage[] }
  | { type: 'settings:update'; settings: ExtensionSettings }
  | { type: 'permission:ask'; request: PermissionRequest }
  | { type: 'agent:status'; status: 'idle' | 'working' | 'waiting'; startedAt?: number };
