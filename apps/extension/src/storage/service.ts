import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import {
  ChatMessage,
  Conversation,
  ConversationSummary,
  ExtensionSettings,
  ExtensionSettingsSchema,
  StoredChatMessage,
} from '@koala/shared';

const DEFAULT_BASE_PATH = path.join(os.homedir(), '.cokoala');

type PersistedConfig = Omit<ExtensionSettings, 'api'> & {
  api: {
    provider: ExtensionSettings['api']['provider'];
    model: string;
  };
};

export class StorageService {
  private readonly basePath: string;
  private readonly chatsPath: string;
  private readonly configPath: string;
  private readonly indexPath: string;
  private flushTimers = new Map<string, NodeJS.Timeout>();

  constructor(basePath = DEFAULT_BASE_PATH) {
    this.basePath = basePath;
    this.chatsPath = path.join(basePath, 'chats');
    this.configPath = path.join(basePath, 'config.json');
    this.indexPath = path.join(this.chatsPath, 'index.json');
  }

  async ensureReady() {
    await fs.mkdir(this.chatsPath, { recursive: true });
    try {
      await fs.access(this.indexPath);
    } catch {
      await fs.writeFile(this.indexPath, '[]', 'utf8');
    }
  }

  getBasePath() {
    return this.basePath;
  }

  async loadConfig(): Promise<Partial<ExtensionSettings>> {
    await this.ensureReady();
    try {
      const raw = await fs.readFile(this.configPath, 'utf8');
      return ExtensionSettingsSchema.partial().parse(JSON.parse(raw));
    } catch {
      return {};
    }
  }

  async saveConfig(settings: ExtensionSettings) {
    await this.ensureReady();
    const toPersist: PersistedConfig = {
      api: {
        provider: settings.api.provider,
        model: settings.api.model,
      },
      mode: settings.mode,
      permissions: settings.permissions,
    };
    await fs.writeFile(this.configPath, JSON.stringify(toPersist, null, 2), 'utf8');
  }

  async createConversation(initialTitle = 'New Chat'): Promise<Conversation> {
    await this.ensureReady();
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id: randomUUID(),
      title: initialTitle,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    await this.writeConversation(conversation);
    await this.upsertSummary(this.toSummary(conversation));
    return conversation;
  }

  async appendMessage(conversationId: string, message: StoredChatMessage) {
    await this.ensureReady();
    const conversation = await this.loadConversation(conversationId);
    const nextTitle = conversation.messages.length === 0 && message.role === 'user'
      ? this.buildTitle(message.content)
      : conversation.title;
    const next: Conversation = {
      ...conversation,
      title: nextTitle,
      updatedAt: message.timestamp,
      messages: [...conversation.messages, message],
    };
    await this.writeConversation(next);
    await this.upsertSummary(this.toSummary(next));
  }

  queueAgentMessage(conversationId: string, content: string) {
    const existing = this.flushTimers.get(conversationId);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      this.flushTimers.delete(conversationId);
      void this.replaceLatestAgentMessage(conversationId, content);
    }, 200);
    this.flushTimers.set(conversationId, timer);
  }

  async flushAgentMessage(conversationId: string, content: string) {
    const existing = this.flushTimers.get(conversationId);
    if (existing) {
      clearTimeout(existing);
      this.flushTimers.delete(conversationId);
    }
    await this.replaceLatestAgentMessage(conversationId, content);
  }

  async listConversations(): Promise<ConversationSummary[]> {
    await this.ensureReady();
    const raw = await fs.readFile(this.indexPath, 'utf8');
    const parsed = JSON.parse(raw) as ConversationSummary[];
    return parsed.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async searchConversations(query: string): Promise<ConversationSummary[]> {
    const summaries = await this.listConversations();
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return summaries;
    }
    return summaries.filter((item) =>
      item.title.toLowerCase().includes(normalized) ||
      item.lastMessagePreview.toLowerCase().includes(normalized)
    );
  }

  async loadConversation(id: string): Promise<Conversation> {
    await this.ensureReady();
    const filePath = path.join(this.chatsPath, `${id}.json`);
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as Conversation;
  }

  async deleteConversation(id: string) {
    await this.ensureReady();
    const existing = this.flushTimers.get(id);
    if (existing) {
      clearTimeout(existing);
      this.flushTimers.delete(id);
    }
    await fs.rm(path.join(this.chatsPath, `${id}.json`), { force: true });
    const summaries = await this.listConversations();
    const next = summaries.filter((item) => item.id !== id);
    await fs.writeFile(this.indexPath, JSON.stringify(next, null, 2), 'utf8');
  }

  async saveSessionSummary(workspacePath: string, conversationId: string, content: string): Promise<string> {
    const summaryDir = path.join(workspacePath, 'session-summaries');
    await fs.mkdir(summaryDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `session-${timestamp}.md`;
    const filePath = path.join(summaryDir, fileName);
    
    const header = `# Session Summary\n\nConversation ID: ${conversationId}\nDate: ${new Date().toLocaleString()}\n\n---\n\n`;
    await fs.writeFile(filePath, header + content, 'utf8');
    
    return filePath;
  }

  private async replaceLatestAgentMessage(conversationId: string, content: string) {
    await this.ensureReady();
    const conversation = await this.loadConversation(conversationId);
    const now = new Date().toISOString();
    const messages = [...conversation.messages];
    const lastMessage = messages[messages.length - 1];

    if (lastMessage?.role === 'agent') {
      messages[messages.length - 1] = {
        ...lastMessage,
        content,
        timestamp: now,
      };
    } else {
      messages.push({
        role: 'agent',
        content,
        timestamp: now,
      });
    }

    const next: Conversation = {
      ...conversation,
      updatedAt: now,
      messages,
    };
    await this.writeConversation(next);
    await this.upsertSummary(this.toSummary(next));
  }

  private async writeConversation(conversation: Conversation) {
    await fs.writeFile(
      path.join(this.chatsPath, `${conversation.id}.json`),
      JSON.stringify(conversation, null, 2),
      'utf8'
    );
  }

  private async upsertSummary(summary: ConversationSummary) {
    const summaries = await this.listConversations();
    const filtered = summaries.filter((item) => item.id !== summary.id);
    filtered.push(summary);
    filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    await fs.writeFile(this.indexPath, JSON.stringify(filtered, null, 2), 'utf8');
  }

  private toSummary(conversation: Conversation): ConversationSummary {
    const lastMessage = conversation.messages.at(-1);
    return {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messageCount: conversation.messages.length,
      lastMessagePreview: (lastMessage?.content || '').slice(0, 80),
    };
  }

  private buildTitle(content: string) {
    const trimmed = content.trim();
    return trimmed ? trimmed.slice(0, 60) : 'New Chat';
  }
}

export function toStoredMessage(message: ChatMessage): StoredChatMessage {
  return {
    role: message.role,
    content: message.content,
    timestamp: new Date().toISOString(),
  };
}
