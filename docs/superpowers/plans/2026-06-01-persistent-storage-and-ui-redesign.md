# Persistent Storage + UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Koala Code's persistent data to `C:\Users\dualt\.cokoala`, add durable chat history with search/load/delete, and refresh the VS Code webview UI with a toolbar header, context bar, history panel, bottom mode pills, and a working activity bar icon.

**Architecture:** Keep filesystem and VS Code integration in the extension host by introducing a focused storage layer plus lightweight migration utility. Extend the existing webview message protocol so the React app can request chat history and receive context updates, while the UI remains a single-screen app split into a main app shell plus a dedicated history panel component.

**Tech Stack:** TypeScript, React 19, VS Code Extension API, Node.js fs/promises, Vite webview bundle, Tailwind CSS utilities, global CSS variables, lucide-react

---

## File Structure

### Files to create
- `apps/extension/src/storage/service.ts`
  - Owns `.cokoala` directory setup, config persistence, conversation persistence, search, load, delete, and debounced agent message flushing.
- `apps/extension/src/storage/migrate.ts`
  - Migrates existing `globalState` settings into `.cokoala/config.json` on activation.
- `apps/extension/media/icon.svg`
  - Activity bar icon using `currentColor`.
- `apps/webview/src/HistoryPanel.tsx`
  - Right-side overlay panel for search, list, load, and delete interactions.

### Files to modify
- `packages/shared/src/index.ts`
  - Add shared conversation/context types and extend the webview/host message unions.
- `apps/extension/src/extension.ts`
  - Run storage migration during activation before constructing the provider.
- `apps/extension/src/webview/provider.ts`
  - Replace `globalState` config reads/writes with the storage service, add chat history handlers, add context update listeners, and persist chat messages in real time.
- `apps/webview/src/App.tsx`
  - Add history/context state, switch the header layout, add mode pills, wire new message types, and integrate the history panel.
- `apps/webview/src/index.css`
  - Add context/history/mode-pill styles while preserving the existing neon accent system.

### Files to inspect while implementing
- `apps/webview/src/Settings.tsx`
- `apps/webview/src/PermissionModal.tsx`
- `apps/extension/package.json`
- `docs/superpowers/specs/2026-06-01-persistent-storage-and-ui-redesign.md`

---

### Task 1: Extend shared types and message protocol

**Files:**
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/index.ts`

- [ ] **Step 1: Add the failing type usage mentally before editing**

The current file only defines `ChatMessage`, `WebviewMessage`, and `HostMessage` for settings, chat update, permission, and status traffic. The implementation will need the following new shared shapes:

```ts
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
```

Without these, any provider or webview code that references conversation or context payloads will fail type-checking.

- [ ] **Step 2: Modify `packages/shared/src/index.ts` to add the new types and protocol cases**

Add the following content after `ChatMessage` and extend the two message unions exactly as shown:

```ts
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
  | { type: 'permission:deny'; id: string };

export type HostMessage =
  | { type: 'chat:update'; messages: ChatMessage[] }
  | { type: 'chat:history:list-result'; conversations: ConversationSummary[] }
  | { type: 'chat:history:load-result'; conversation: Conversation }
  | { type: 'chat:history:search-result'; conversations: ConversationSummary[] }
  | { type: 'context:update'; context: ContextInfo }
  | { type: 'settings:update'; settings: ExtensionSettings }
  | { type: 'permission:ask'; request: PermissionRequest }
  | { type: 'agent:status'; status: 'idle' | 'working' | 'waiting'; startedAt?: number };
```

- [ ] **Step 3: Run a targeted type-check for the shared package**

Run:

```powershell
pnpm --filter @koala/shared exec tsc --noEmit
```

Expected: command succeeds with no TypeScript errors.

- [ ] **Step 4: Commit the shared protocol work**

Run:

```bash
git add packages/shared/src/index.ts
git commit -m "feat: add shared chat history protocol types"
```

Expected: one commit containing only the shared type/protocol update.

---

### Task 2: Add storage migration and persistent storage service

**Files:**
- Create: `apps/extension/src/storage/service.ts`
- Create: `apps/extension/src/storage/migrate.ts`
- Modify: `apps/extension/src/extension.ts`
- Test: `apps/extension/src/storage/service.ts`

- [ ] **Step 1: Create the storage service with concrete interfaces and helpers**

Create `apps/extension/src/storage/service.ts` with this full implementation skeleton and types:

```ts
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import { ChatMessage, Conversation, ConversationSummary, ExtensionSettings, ExtensionSettingsSchema, StoredChatMessage } from '@koala/shared';

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
    const timer = setTimeout(async () => {
      this.flushTimers.delete(conversationId);
      await this.appendMessage(conversationId, {
        role: 'agent',
        content,
        timestamp: new Date().toISOString(),
      });
    }, 200);
    this.flushTimers.set(conversationId, timer);
  }

  async flushAgentMessage(conversationId: string, content: string) {
    const existing = this.flushTimers.get(conversationId);
    if (existing) {
      clearTimeout(existing);
      this.flushTimers.delete(conversationId);
    }
    await this.appendMessage(conversationId, {
      role: 'agent',
      content,
      timestamp: new Date().toISOString(),
    });
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
    await fs.rm(path.join(this.chatsPath, `${id}.json`), { force: true });
    const summaries = await this.listConversations();
    const next = summaries.filter((item) => item.id !== id);
    await fs.writeFile(this.indexPath, JSON.stringify(next, null, 2), 'utf8');
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
```

- [ ] **Step 2: Create the migration utility**

Create `apps/extension/src/storage/migrate.ts` with this implementation:

```ts
import * as vscode from 'vscode';
import { ExtensionSettings, ExtensionSettingsSchema } from '@koala/shared';
import { StorageService } from './service';

export async function migrateLegacySettings(
  context: vscode.ExtensionContext,
  storage: StorageService
) {
  await storage.ensureReady();
  const diskSettings = await storage.loadConfig();
  if (Object.keys(diskSettings).length > 0) {
    return;
  }

  const raw = context.globalState.get('koalaSettings') || {};
  let settings: ExtensionSettings;
  try {
    settings = ExtensionSettingsSchema.parse(raw);
  } catch {
    settings = ExtensionSettingsSchema.parse({});
  }

  await storage.saveConfig(settings);
  await context.globalState.update('koalaSettings', undefined);
}
```

- [ ] **Step 3: Update activation to run the migration before constructing the provider**

Replace `apps/extension/src/extension.ts` with this version:

```ts
import * as vscode from 'vscode';
import { KoalaWebviewProvider } from './webview/provider';
import { startIPCSocket } from './ipc/socket';
import { StorageService } from './storage/service';
import { migrateLegacySettings } from './storage/migrate';

export async function activate(context: vscode.ExtensionContext) {
  console.log('Koala Code extension is now active!');

  const storage = new StorageService();
  await migrateLegacySettings(context, storage);

  const provider = new KoalaWebviewProvider(context, storage);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(KoalaWebviewProvider.viewType, provider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('koalaCode.start', () => {
      vscode.commands.executeCommand('workbench.view.extension.koala-sidebar');
    })
  );

  startIPCSocket(context);
}

export function deactivate() {}
```

- [ ] **Step 4: Run a targeted extension type-check to verify the new files compile**

Run:

```powershell
pnpm --filter koala-extension exec tsc --noEmit
```

Expected: command succeeds, though `provider.ts` will still fail until Task 3 is complete if the constructor signature has been changed early. If that happens, finish Task 3 immediately before rerunning this command.

- [ ] **Step 5: Commit the storage foundation**

Run:

```bash
git add apps/extension/src/storage/service.ts apps/extension/src/storage/migrate.ts apps/extension/src/extension.ts
git commit -m "feat: add persistent extension storage service"
```

Expected: one commit containing migration and storage-service scaffolding.

---

### Task 3: Rework the extension provider for persistent settings, history, and context updates

**Files:**
- Modify: `apps/extension/src/webview/provider.ts`
- Test: `apps/extension/src/webview/provider.ts`

- [ ] **Step 1: Replace the provider imports, constructor, fields, and webview-ready boot flow**

Update the top of `apps/extension/src/webview/provider.ts` so it imports the new shared types and accepts `StorageService` in the constructor:

```ts
import * as path from 'path';
import * as vscode from 'vscode';
import {
  ChatMessage,
  ContextInfo,
  ExtensionSettings,
  ExtensionSettingsSchema,
  HostMessage,
  PermissionRequest,
  WebviewMessage,
} from '@koala/shared';
import { KoalaAgent } from '@koala/core';
import { StorageService } from '../storage/service';

export class KoalaWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'koalaCode.webview';

  private _view?: vscode.WebviewView;
  private _agent?: KoalaAgent;
  private _messages: ChatMessage[] = [];
  private _isProcessing = false;
  private _activeConversationId: string | null = null;
  private _permissionResolvers: Map<string, (approved: boolean) => void> = new Map();

  constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _storage: StorageService
  ) {}
```

Also add these helper methods below `resolveWebviewView`:

```ts
  private async bootstrapWebview() {
    await this.syncSettings();
    await this.syncHistory();
    await this.postContext();
    this.postMessage({ type: 'chat:update', messages: this._messages });
  }

  private async syncHistory() {
    const conversations = await this._storage.listConversations();
    this.postMessage({ type: 'chat:history:list-result', conversations });
  }
```

Then change the `webview:ready` case in the message switch to:

```ts
        case 'webview:ready':
          await this.bootstrapWebview();
          break;
```

- [ ] **Step 2: Replace settings reads/writes so config comes from `.cokoala` and secrets remain in SecretStorage**

Replace `getSettings`, `saveSettings`, and `syncSettings` with this exact implementation:

```ts
  private async getSettings(): Promise<ExtensionSettings> {
    const raw = await this._storage.loadConfig();
    let settings: ExtensionSettings;
    try {
      settings = ExtensionSettingsSchema.parse(raw);
    } catch {
      settings = ExtensionSettingsSchema.parse({});
    }

    const apiKey = await this._context.secrets.get('koalaApiKey');
    if (apiKey) {
      settings.api.apiKey = apiKey;
    }
    return settings;
  }

  private async saveSettings(partial: Partial<ExtensionSettings>) {
    const current = await this.getSettings();
    const next = {
      ...current,
      api: { ...current.api, ...partial.api },
      permissions: { ...current.permissions, ...partial.permissions },
    };
    if (partial.mode) {
      next.mode = partial.mode;
    }

    if (partial.api?.apiKey) {
      await this._context.secrets.store('koalaApiKey', partial.api.apiKey);
    }

    await this._storage.saveConfig(next);
  }

  private async syncSettings() {
    const settings = await this.getSettings();
    this.postMessage({ type: 'settings:update', settings });
    this._agent = new KoalaAgent(
      {
        provider: settings.api.provider,
        model: settings.api.model,
        apiKey: settings.api.apiKey,
      },
      settings.mode
    );
  }
```

- [ ] **Step 3: Add context detection helpers and subscriptions**

Add these methods inside the class:

```ts
  private async postContext() {
    const context = await this.getContextInfo();
    this.postMessage({ type: 'context:update', context });
  }

  private async getContextInfo(): Promise<ContextInfo> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const activeEditor = vscode.window.activeTextEditor;
    const activeFile = activeEditor ? path.basename(activeEditor.document.fileName) : undefined;
    const branch = await this.getGitBranch(workspaceFolder?.uri.fsPath);

    return {
      workspace: workspaceFolder?.name,
      activeFile,
      branch,
    };
  }

  private async getGitBranch(cwd?: string) {
    if (!cwd) {
      return undefined;
    }

    try {
      const terminal = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(terminal.exec);
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd });
      const branch = stdout.trim();
      return branch || undefined;
    } catch {
      return undefined;
    }
  }
```

Then, inside `resolveWebviewView`, register the active-editor listener and push it into subscriptions:

```ts
    this._context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        void this.postContext();
      })
    );
```

- [ ] **Step 4: Extend the webview message switch with history and new-chat cases**

Add these switch branches inside `onDidReceiveMessage`:

```ts
        case 'chat:new':
          this._messages = [];
          this._activeConversationId = null;
          this.postMessage({ type: 'chat:update', messages: this._messages });
          await this.syncHistory();
          break;
        case 'chat:history:list':
          await this.syncHistory();
          break;
        case 'chat:history:search': {
          const conversations = await this._storage.searchConversations(data.query);
          this.postMessage({ type: 'chat:history:search-result', conversations });
          break;
        }
        case 'chat:history:load': {
          const conversation = await this._storage.loadConversation(data.id);
          this._activeConversationId = conversation.id;
          this._messages = conversation.messages.map((message) => ({
            role: message.role,
            content: message.content,
          }));
          this.postMessage({ type: 'chat:history:load-result', conversation });
          this.postMessage({ type: 'chat:update', messages: this._messages });
          break;
        }
        case 'chat:history:delete':
          await this._storage.deleteConversation(data.id);
          if (this._activeConversationId === data.id) {
            this._activeConversationId = null;
            this._messages = [];
            this.postMessage({ type: 'chat:update', messages: this._messages });
          }
          await this.syncHistory();
          break;
```

- [ ] **Step 5: Persist messages in `handleChatSend` and during streaming agent output**

Replace the body of `handleChatSend` with the following implementation:

```ts
  private async handleChatSend(input: string) {
    const trimmedInput = input.trim();
    if (!trimmedInput || this._isProcessing) {
      return;
    }

    if (!this._agent) {
      vscode.window.showErrorMessage('Agent not initialized. Please configure your API key in Settings.');
      return;
    }

    const settings = await this.getSettings();
    if (!settings.api.apiKey) {
      vscode.window.showErrorMessage('No API key configured. Click the ⚙ gear icon to add one.');
      return;
    }
    if (!settings.api.model) {
      vscode.window.showErrorMessage('No model selected. Click the ⚙ gear icon to choose one.');
      return;
    }

    if (!this._activeConversationId) {
      const conversation = await this._storage.createConversation();
      this._activeConversationId = conversation.id;
    }

    this._isProcessing = true;
    this._messages.push({ role: 'user', content: trimmedInput });
    this._messages.push({ role: 'agent', content: '' });
    this.postMessage({ type: 'chat:update', messages: this._messages });
    this.postMessage({ type: 'agent:status', status: 'working', startedAt: Date.now() });

    await this._storage.appendMessage(this._activeConversationId, {
      role: 'user',
      content: trimmedInput,
      timestamp: new Date().toISOString(),
    });
    await this.syncHistory();

    try {
      const coreMessages = this._messages
        .filter((message) => message.content)
        .map((message) => ({
          role: message.role === 'agent' ? ('assistant' as const) : ('user' as const),
          content: message.content,
        }));

      await this._agent.processChat(coreMessages, {
        onChunk: (chunk: string) => {
          if (!chunk) {
            return;
          }

          const current = this._messages[this._messages.length - 1];
          if (current?.role === 'agent') {
            current.content += chunk;
            this.postMessage({ type: 'chat:update', messages: this._messages });
            if (this._activeConversationId) {
              void this._storage.queueAgentMessage(this._activeConversationId, current.content);
            }
          }
        },
        onRequestPermission: async (request: PermissionRequest) => {
          const currentSettings = await this.getSettings();

          if (request.tool === 'read_file' && currentSettings.permissions.autoApproveFileRead) return true;
          if (request.tool === 'write_file' && currentSettings.permissions.autoApproveFileWrite) return true;
          if (request.tool === 'run_command' && currentSettings.permissions.autoApproveCommandExecution) return true;

          this.postMessage({ type: 'permission:ask', request });
          this.postMessage({ type: 'agent:status', status: 'waiting' });

          return new Promise<boolean>((resolve) => {
            this._permissionResolvers.set(request.id, (approved) => {
              this.postMessage({ type: 'agent:status', status: 'working', startedAt: Date.now() });
              resolve(approved);
            });
          });
        },
      });
    } catch (e: any) {
      console.error('[Koala Code] Agent error:', e);
      const errMsg = e?.message || String(e) || 'Unknown error';
      this._messages[this._messages.length - 1].content += `\n\n⚠️ Error: ${errMsg}`;
      this.postMessage({ type: 'chat:update', messages: this._messages });
    } finally {
      const lastMessage = this._messages[this._messages.length - 1];
      if (lastMessage?.role === 'agent' && !lastMessage.content.trim()) {
        lastMessage.content = 'I finished the request, but did not receive any text from the model.';
        this.postMessage({ type: 'chat:update', messages: this._messages });
      }
      if (this._activeConversationId) {
        await this._storage.flushAgentMessage(this._activeConversationId, this._messages[this._messages.length - 1]?.content || '');
        await this.syncHistory();
      }
      this._isProcessing = false;
      this.postMessage({ type: 'agent:status', status: 'idle' });
    }
  }
```

- [ ] **Step 6: Run the extension type-check after the provider rewrite**

Run:

```powershell
pnpm --filter koala-extension exec tsc --noEmit
```

Expected: command succeeds with no extension TypeScript errors.

- [ ] **Step 7: Commit the provider changes**

Run:

```bash
git add apps/extension/src/webview/provider.ts
git commit -m "feat: persist chat history in extension provider"
```

Expected: one commit with settings migration usage, history protocol handling, and context update support.

---

### Task 4: Add the history panel component and redesign the webview app shell

**Files:**
- Create: `apps/webview/src/HistoryPanel.tsx`
- Modify: `apps/webview/src/App.tsx`
- Test: `apps/webview/src/App.tsx`

- [ ] **Step 1: Create the history panel component**

Create `apps/webview/src/HistoryPanel.tsx` with this component:

```tsx
import React from 'react';
import { Clock3, Plus, Search, Trash2, X } from 'lucide-react';
import { ConversationSummary } from '@koala/shared';

type HistoryPanelProps = {
  open: boolean;
  conversations: ConversationSummary[];
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onNewChat: () => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
};

function formatRelativeDate(value: string) {
  const date = new Date(value);
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
    Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60)),
    'hour'
  );
}

export function HistoryPanel({
  open,
  conversations,
  query,
  onQueryChange,
  onClose,
  onNewChat,
  onLoad,
  onDelete,
}: HistoryPanelProps) {
  return (
    <aside
      className={[
        'absolute inset-y-0 right-0 z-40 w-full max-w-sm border-l border-[var(--koala-border)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_92%,black_8%)] shadow-[-24px_0_48px_rgba(0,0,0,0.35)] transition-transform duration-200',
        open ? 'translate-x-0' : 'translate-x-full',
      ].join(' ')}
      aria-hidden={!open}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-[var(--koala-border)] px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white/90">
            <Clock3 size={16} className="text-[var(--koala-accent)]" />
            <span>Chat History</span>
          </div>
          <button onClick={onClose} className="koala-toolbar-button" type="button">
            <X size={16} />
          </button>
        </div>

        <div className="border-b border-[var(--koala-border)] px-4 py-3">
          <button onClick={onNewChat} type="button" className="koala-primary-button mb-3 w-full justify-center">
            <Plus size={16} />
            <span>New Chat</span>
          </button>
          <label className="koala-search-shell">
            <Search size={15} className="text-white/45" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search chats"
              className="koala-search-input"
              type="text"
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {conversations.length === 0 ? (
            <div className="koala-panel rounded-2xl px-4 py-5 text-center text-xs text-white/60">
              No saved chats yet.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {conversations.map((conversation) => (
                <div key={conversation.id} className="koala-history-item">
                  <button
                    type="button"
                    onClick={() => onLoad(conversation.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-sm font-medium text-white/90">{conversation.title}</div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-white/45">
                      <span>{formatRelativeDate(conversation.updatedAt)}</span>
                      <span>•</span>
                      <span>{conversation.messageCount} messages</span>
                    </div>
                    <div className="mt-2 line-clamp-2 text-xs text-white/55">{conversation.lastMessagePreview || 'No preview available'}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(conversation.id)}
                    className="koala-toolbar-button shrink-0"
                    aria-label={`Delete ${conversation.title}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Replace `apps/webview/src/App.tsx` with the redesigned app shell**

Replace the current file contents with the following implementation:

```tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Clock3, Plus, Send, Settings, User } from 'lucide-react';
import {
  AgentMode,
  ChatMessage,
  ContextInfo,
  Conversation,
  ConversationSummary,
  ExtensionSettings,
  HostMessage,
  PermissionRequest,
  WebviewMessage,
} from '@koala/shared';
import { SettingsView } from './Settings';
import { PermissionModal } from './PermissionModal';
import { HistoryPanel } from './HistoryPanel';

function ThinkingTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 100);
    return () => clearInterval(interval);
  }, [startedAt]);

  return <span>{elapsed}s</span>;
}

function getStatusMeta(agentStatus: 'idle' | 'working' | 'waiting', elapsedSeconds: number) {
  if (agentStatus === 'waiting') {
    return {
      title: 'Waiting for approval',
      subtitle: 'Review the pending action to keep the run moving.',
      badge: 'Approval needed',
    };
  }

  const phases = ['Reviewing context', 'Planning response', 'Polishing output'];

  return {
    title: 'Thinking',
    subtitle: phases[Math.floor(elapsedSeconds / 3) % phases.length],
    badge: 'Agent active',
  };
}

const modeOptions: AgentMode[] = ['code', 'architect', 'ask', 'debug', 'orchestrator'];

function formatContext(context: ContextInfo) {
  return [
    context.workspace ? `📁 ${context.workspace}` : null,
    context.activeFile ? `📄 ${context.activeFile}` : null,
    context.branch ? ` ${context.branch}` : null,
  ].filter(Boolean);
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
  const [agentStatus, setAgentStatus] = useState<'idle' | 'working' | 'waiting'>('idle');
  const [thinkingStartedAt, setThinkingStartedAt] = useState<number | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [contextInfo, setContextInfo] = useState<ContextInfo>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAgentActive = agentStatus === 'working' || agentStatus === 'waiting';
  const elapsedSeconds = thinkingStartedAt ? Math.floor((Date.now() - thinkingStartedAt) / 1000) : 0;
  const statusMeta = getStatusMeta(agentStatus, elapsedSeconds);
  const contextChips = useMemo(() => formatContext(contextInfo), [contextInfo]);

  const vscode = (window as any).vscode;
  const postMessage = (msg: WebviewMessage) => {
    if (vscode) {
      vscode.postMessage(msg);
    }
  };

  useEffect(() => {
    postMessage({ type: 'webview:ready' });
    postMessage({ type: 'settings:get' });
    postMessage({ type: 'chat:history:list' });

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data as HostMessage;
      switch (msg.type) {
        case 'settings:update':
          setSettings(msg.settings);
          break;
        case 'chat:update':
          setMessages(msg.messages);
          break;
        case 'chat:history:list-result':
        case 'chat:history:search-result':
          setConversations(msg.conversations);
          break;
        case 'chat:history:load-result':
          setActiveConversationId(msg.conversation.id);
          setMessages(msg.conversation.messages.map((item) => ({ role: item.role, content: item.content })));
          setShowHistory(false);
          break;
        case 'context:update':
          setContextInfo(msg.context);
          break;
        case 'permission:ask':
          setPermissions((prev) => [...prev, msg.request]);
          break;
        case 'agent:status':
          setAgentStatus(msg.status);
          if (msg.status === 'working' && msg.startedAt) {
            setThinkingStartedAt(msg.startedAt);
          } else if (msg.status === 'idle') {
            setThinkingStartedAt(null);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, permissions, agentStatus, showHistory]);

  const handleSend = () => {
    if (!input.trim() || agentStatus !== 'idle') return;
    setMessages((prev) => [...prev, { role: 'user', content: input }]);
    postMessage({ type: 'chat:send', value: input });
    setInput('');
  };

  const handleSaveSettings = (newSettings: Partial<ExtensionSettings>) => {
    postMessage({ type: 'settings:save', settings: newSettings });
  };

  const handleApprove = (id: string) => {
    setPermissions((prev) => prev.filter((permission) => permission.id !== id));
    postMessage({ type: 'permission:approve', id });
  };

  const handleDeny = (id: string) => {
    setPermissions((prev) => prev.filter((permission) => permission.id !== id));
    postMessage({ type: 'permission:deny', id });
  };

  const handleNewChat = () => {
    setMessages([]);
    setActiveConversationId(null);
    setShowHistory(false);
    setSearchQuery('');
    postMessage({ type: 'chat:new' });
  };

  const handleHistorySearch = (value: string) => {
    setSearchQuery(value);
    postMessage({ type: 'chat:history:search', query: value });
  };

  const handleLoadConversation = (id: string) => {
    postMessage({ type: 'chat:history:load', id });
  };

  const handleDeleteConversation = (id: string) => {
    const confirmed = window.confirm('Delete this conversation permanently?');
    if (!confirmed) {
      return;
    }
    if (activeConversationId === id) {
      setActiveConversationId(null);
      setMessages([]);
    }
    postMessage({ type: 'chat:history:delete', id });
  };

  if (!settings) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--vscode-editor-background)] p-4 text-[var(--vscode-editor-foreground)]">
        <div className="koala-panel-strong w-full max-w-xs rounded-2xl px-5 py-4 text-center text-xs text-white/70">
          <div className="mb-2 text-sm font-semibold text-white/90">Loading settings...</div>
          <div className="h-1 overflow-hidden rounded-full bg-white/10">
            <div className="koala-rainbow-bar h-full w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[var(--vscode-editor-background)] text-sm text-[var(--vscode-editor-foreground)]">
      <header className="shrink-0 border-b border-[var(--koala-border)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_82%,black_18%)] px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="koala-panel-strong koala-glow flex h-9 w-9 items-center justify-center rounded-xl">
              <Bot size={18} className="text-[var(--koala-accent)]" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold tracking-[0.01em]">Koala Code</div>
              <div className="text-[11px] text-white/55">Persistent coding workflow</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={handleNewChat} className="koala-toolbar-button">
              <Plus size={16} />
            </button>
            <button type="button" onClick={() => setShowHistory((value) => !value)} className="koala-toolbar-button">
              <Clock3 size={16} />
            </button>
            <button type="button" onClick={() => setShowSettings(true)} className="koala-toolbar-button">
              <Settings size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="shrink-0 border-b border-[var(--koala-border)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_90%,white_10%)] px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/70">
          {contextChips.length > 0 ? (
            contextChips.map((chip) => (
              <span key={chip} className="koala-context-chip">
                {chip}
              </span>
            ))
          ) : (
            <span className="koala-context-chip">No active context</span>
          )}
        </div>
      </div>

      <div className="h-1 shrink-0 overflow-hidden bg-white/5">
        {isAgentActive && <div className="koala-rainbow-bar h-full w-full shadow-[0_0_16px_var(--koala-glow)]" />}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {messages.length === 0 && (
            <div className="koala-panel mx-auto mt-10 max-w-sm rounded-2xl px-5 py-6 text-center text-xs text-white/60">
              <div className="mb-2 text-sm font-medium text-white/85">How can I help you code today?</div>
              <div>Your chats are now stored under C:\Users\dualt\.cokoala.</div>
            </div>
          )}

          {messages.map((message, index) => (
            <div key={index} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'agent' && (
                <div className="koala-panel-strong mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
                  <Bot size={15} className="text-[var(--koala-accent)]" />
                </div>
              )}
              <div
                className={[
                  'max-w-[88%] break-words whitespace-pre-wrap rounded-2xl border px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.18)]',
                  message.role === 'user'
                    ? 'border-[var(--koala-border-strong)] bg-[color:color-mix(in_srgb,var(--vscode-textLink-foreground)_18%,var(--vscode-editor-background)_82%)] text-white'
                    : 'koala-panel text-[var(--vscode-editor-foreground)]',
                ].join(' ')}
              >
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                  {message.role === 'user' ? 'You' : 'Koala'}
                </div>
                <div>{message.content}</div>
              </div>
              {message.role === 'user' && (
                <div className="koala-panel mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
                  <User size={15} className="text-white/80" />
                </div>
              )}
            </div>
          ))}

          {permissions.map((request) => (
            <PermissionModal key={request.id} request={request} onApprove={handleApprove} onDeny={handleDeny} />
          ))}

          {isAgentActive && (
            <div className="flex justify-start">
              <div className="koala-panel-strong w-full max-w-[88%] rounded-2xl px-4 py-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="koala-panel-strong koala-glow flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                      <Bot size={16} className="text-[var(--koala-accent)]" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white/92">{statusMeta.title}</div>
                      <div className="koala-status-copy text-xs text-white/65">{statusMeta.subtitle}</div>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-white/55">
                    <div className="mb-1 rounded-full border border-white/10 px-2 py-1 uppercase tracking-[0.12em]">
                      {statusMeta.badge}
                    </div>
                    <div>{thinkingStartedAt && <ThinkingTimer startedAt={thinkingStartedAt} />}</div>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/8">
                  <div className="koala-rainbow-bar h-full w-full" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-[var(--koala-border)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_88%,black_12%)] px-3 py-3">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {modeOptions.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleSaveSettings({ mode })}
                className={['koala-mode-pill', settings.mode === mode ? 'koala-mode-pill-active' : ''].join(' ')}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="flex gap-2 rounded-2xl border border-[var(--koala-border)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_86%,white_14%)] p-2 shadow-[0_-10px_30px_rgba(0,0,0,0.12)]">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleSend()}
              placeholder={agentStatus === 'idle' ? 'Type a message...' : 'Agent is busy...'}
              disabled={agentStatus !== 'idle'}
              className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-3 py-2 text-sm text-[var(--vscode-editor-foreground)] outline-none transition-colors focus:border-[var(--koala-border-strong)] focus:bg-white/3 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || agentStatus !== 'idle'}
              className="inline-flex items-center justify-center rounded-xl border border-[var(--koala-border-strong)] bg-[color:color-mix(in_srgb,var(--vscode-button-background)_78%,white_22%)] px-3 py-2 text-[var(--vscode-button-foreground)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      <HistoryPanel
        open={showHistory}
        conversations={conversations}
        query={searchQuery}
        onQueryChange={handleHistorySearch}
        onClose={() => setShowHistory(false)}
        onNewChat={handleNewChat}
        onLoad={handleLoadConversation}
        onDelete={handleDeleteConversation}
      />

      {showSettings && (
        <SettingsView settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run a targeted webview type-check/build after the component split**

Run:

```powershell
pnpm --filter webview build
```

Expected: the Vite build succeeds and emits updated assets in the webview dist folder.

- [ ] **Step 4: Commit the webview layout and history component**

Run:

```bash
git add apps/webview/src/App.tsx apps/webview/src/HistoryPanel.tsx
git commit -m "feat: redesign webview shell and add history panel"
```

Expected: one commit containing the new app layout and history overlay component.

---

### Task 5: Add CSS support for toolbar buttons, context chips, history panel, and mode pills

**Files:**
- Modify: `apps/webview/src/index.css`
- Test: `apps/webview/src/index.css`

- [ ] **Step 1: Append the new shared CSS utility classes**

Add the following classes to the end of `apps/webview/src/index.css`:

```css
.koala-toolbar-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border-radius: 0.75rem;
  border: 1px solid var(--koala-border);
  background: color-mix(in srgb, var(--koala-surface) 90%, transparent);
  color: var(--vscode-editor-foreground);
  padding: 0.55rem;
  transition: border-color 160ms ease, background-color 160ms ease, transform 160ms ease;
}

.koala-toolbar-button:hover {
  border-color: var(--koala-border-strong);
  background: color-mix(in srgb, var(--koala-surface-soft) 92%, white 8%);
  transform: translateY(-1px);
}

.koala-primary-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--koala-border-strong);
  border-radius: 0.9rem;
  padding: 0.7rem 0.9rem;
  background: color-mix(in srgb, var(--vscode-button-background) 78%, white 22%);
  color: var(--vscode-button-foreground);
  transition: filter 160ms ease, transform 160ms ease;
}

.koala-primary-button:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
}

.koala-context-chip {
  border: 1px solid var(--koala-border);
  border-radius: 999px;
  padding: 0.3rem 0.65rem;
  background: color-mix(in srgb, var(--koala-surface) 90%, transparent);
  white-space: nowrap;
}

.koala-mode-pill {
  border: 1px solid var(--koala-border);
  border-radius: 999px;
  padding: 0.45rem 0.8rem;
  background: color-mix(in srgb, var(--koala-surface) 90%, transparent);
  color: color-mix(in srgb, var(--vscode-editor-foreground) 82%, white 18%);
  font-size: 0.75rem;
  text-transform: capitalize;
  transition: border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease;
}

.koala-mode-pill:hover {
  border-color: var(--koala-border-strong);
}

.koala-mode-pill-active {
  border-color: var(--koala-border-strong);
  background: color-mix(in srgb, var(--koala-accent-soft) 36%, var(--koala-surface) 64%);
  color: white;
  box-shadow: 0 0 18px color-mix(in srgb, var(--koala-glow) 30%, transparent);
}

.koala-search-shell {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  border: 1px solid var(--koala-border);
  border-radius: 1rem;
  background: color-mix(in srgb, var(--koala-surface) 92%, transparent);
  padding: 0.75rem 0.9rem;
}

.koala-search-input {
  width: 100%;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--vscode-editor-foreground);
  font-size: 0.875rem;
}

.koala-history-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  border: 1px solid var(--koala-border);
  border-radius: 1rem;
  background: color-mix(in srgb, var(--koala-surface) 92%, transparent);
  padding: 0.9rem;
}

.koala-history-item:hover {
  border-color: var(--koala-border-strong);
  box-shadow: 0 0 18px color-mix(in srgb, var(--koala-glow) 12%, transparent);
}
```

- [ ] **Step 2: Run the webview build again to ensure the CSS compiles cleanly**

Run:

```powershell
pnpm --filter webview build
```

Expected: build succeeds with no CSS processing errors.

- [ ] **Step 3: Commit the CSS support layer**

Run:

```bash
git add apps/webview/src/index.css
git commit -m "feat: add webview history and mode pill styles"
```

Expected: one commit containing the styling utilities only.

---

### Task 6: Add the missing activity bar icon asset

**Files:**
- Create: `apps/extension/media/icon.svg`
- Test: `apps/extension/media/icon.svg`

- [ ] **Step 1: Create the icon SVG using `currentColor`**

Create `apps/extension/media/icon.svg` with this content:

```svg
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M7 6.5C7 4.567 8.567 3 10.5 3C11.554 3 12.499 3.466 13.141 4.203C13.49 4.073 13.867 4 14.262 4C16.027 4 17.457 5.43 17.457 7.195C17.457 7.422 17.434 7.644 17.389 7.858C18.975 8.578 20 10.16 20 12C20 14.761 17.761 17 15 17H9C6.239 17 4 14.761 4 12C4 10.15 5.036 8.561 6.636 7.846C6.517 7.423 7 7.026 7 6.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="9.25" cy="10.75" r="1" fill="currentColor"/>
  <circle cx="14.75" cy="10.75" r="1" fill="currentColor"/>
  <path d="M10 13.75C10.472 14.403 11.189 14.75 12 14.75C12.811 14.75 13.528 14.403 14 13.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 2: Verify the extension package still references the same path**

Inspect `apps/extension/package.json` and confirm this block remains unchanged:

```json
"viewsContainers": {
  "activitybar": [
    {
      "id": "koala-sidebar",
      "title": "Koala Code",
      "icon": "media/icon.svg"
    }
  ]
}
```

Expected: no JSON edits are required because the path already matches the new asset.

- [ ] **Step 3: Commit the activity bar icon**

Run:

```bash
git add apps/extension/media/icon.svg
git commit -m "feat: add koala activity bar icon"
```

Expected: one commit adding only the SVG asset.

---

### Task 7: End-to-end verification, build, and manual persistence smoke test

**Files:**
- Modify: none
- Test: workspace scripts and generated `.cokoala` files on disk

- [ ] **Step 1: Run the workspace type-check**

Run:

```powershell
pnpm typecheck
```

Expected: all workspace packages pass type-checking.

- [ ] **Step 2: Run the workspace lint command**

Run:

```powershell
pnpm lint
```

Expected: lint passes for the updated extension and webview code.

- [ ] **Step 3: Run the workspace build command**

Run:

```powershell
pnpm build
```

Expected: all build targets succeed and the extension/webview bundles are rebuilt.

- [ ] **Step 4: Launch the extension in VS Code Extension Development Host**

Use the existing VS Code debug flow for this repository. After it launches, manually verify the following in order:

1. Open the Koala Code activity bar view and confirm the new icon appears.
2. Open Settings, enter provider/model/API key, save, then confirm `C:\Users\dualt\.cokoala\config.json` exists and does **not** contain the API key.
3. Send a short prompt like `say hello` and confirm a conversation JSON file appears in `C:\Users\dualt\.cokoala\chats\` plus an updated `index.json` entry.
4. While the model is responding, confirm the active conversation file updates and final agent text is present after completion.
5. Click History, confirm the saved conversation appears, search for a word in its title/preview, and load it back into the thread.
6. Delete the loaded conversation from the history panel and confirm the corresponding JSON file is removed.
7. Switch tabs in VS Code and confirm the context bar updates with the active file name. If the repo is on git, confirm the branch chip appears.
8. Change the mode using the bottom pill bar, reload the webview, and confirm the selected mode persists.

Expected: each interaction behaves exactly as described with no error popups.

- [ ] **Step 5: Commit the verified final state**

Run:

```bash
git add .
git commit -m "feat: add persistent storage and chat history UI"
```

Expected: final integration commit after all verification passes.

---

## Self-Review

### Spec coverage
- `.cokoala` storage location: covered in Tasks 2, 3, and 7.
- API key remains secure: covered in Tasks 2, 3, and 7.
- Automatic chat history persistence: covered in Tasks 2 and 3.
- View/search/load/delete chat history: covered in Tasks 1, 3, 4, and 7.
- Header redesign: covered in Task 4.
- Activity bar icon: covered in Task 6.
- Mode toggle moved to bottom: covered in Task 4 and Task 5.
- Context bar: covered in Tasks 1, 3, 4, and 7.
- Responsiveness/VS Code alignment: covered in Tasks 4 and 5.
- Basic functionality testing: covered in Task 7.

### Placeholder scan
- No `TODO`, `TBD`, or deferred implementation notes remain.
- Every file path is explicit.
- Every command is explicit.
- Every code-writing step includes concrete code.

### Type consistency
- `StoredChatMessage`, `Conversation`, `ConversationSummary`, and `ContextInfo` are introduced in Task 1 and reused consistently later.
- `chat:history:list-result`, `chat:history:load-result`, `chat:history:search-result`, and `context:update` use the same payload shapes in both provider and webview tasks.
- `KoalaWebviewProvider` constructor signature in Task 3 matches the activation change in Task 2.

