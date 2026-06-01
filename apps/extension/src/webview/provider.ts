import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
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

const execAsync = promisify(exec);

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

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    const webviewAppUri = vscode.Uri.joinPath(this._context.extensionUri, '..', 'webview', 'dist');

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._context.extensionUri, webviewAppUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    this._context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        void this.postContext();
      })
    );

    webviewView.webview.onDidReceiveMessage(async (data: WebviewMessage) => {
      switch (data.type) {
        case 'webview:ready':
          await this.bootstrapWebview();
          break;
        case 'settings:get':
          await this.syncSettings();
          break;
        case 'settings:save':
          await this.saveSettings(data.settings);
          await this.syncSettings();
          break;
        case 'chat:send':
          await this.handleChatSend(data.value);
          break;
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
        case 'permission:approve':
          this.resolvePermission(data.id, true);
          break;
        case 'permission:deny':
          this.resolvePermission(data.id, false);
          break;
      }
    });
  }

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
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd });
      const branch = stdout.trim();
      return branch || undefined;
    } catch {
      return undefined;
    }
  }

  private postMessage(msg: HostMessage) {
    this._view?.webview.postMessage(msg);
  }

  private resolvePermission(id: string, approved: boolean) {
    const resolver = this._permissionResolvers.get(id);
    if (resolver) {
      resolver(approved);
      this._permissionResolvers.delete(id);
    }
  }

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
      vscode.window.showErrorMessage('No API key configured. Click the gear icon to add one.');
      return;
    }
    if (!settings.api.model) {
      vscode.window.showErrorMessage('No model selected. Click the gear icon to choose one.');
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
              this._storage.queueAgentMessage(this._activeConversationId, current.content);
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
      this._messages[this._messages.length - 1].content += `\n\nError: ${errMsg}`;
      this.postMessage({ type: 'chat:update', messages: this._messages });
    } finally {
      const lastMessage = this._messages[this._messages.length - 1];
      if (lastMessage?.role === 'agent' && !lastMessage.content.trim()) {
        lastMessage.content = 'I finished the request, but did not receive any text from the model.';
        this.postMessage({ type: 'chat:update', messages: this._messages });
      }
      if (this._activeConversationId) {
        await this._storage.flushAgentMessage(
          this._activeConversationId,
          this._messages[this._messages.length - 1]?.content || ''
        );
        await this.syncHistory();
      }
      this._isProcessing = false;
      this.postMessage({ type: 'agent:status', status: 'idle' });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const webviewAppUri = vscode.Uri.joinPath(this._context.extensionUri, '..', 'webview', 'dist');

    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewAppUri, 'assets', 'index.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewAppUri, 'assets', 'index.css'));

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Koala Code</title>
        <link href="${styleUri}" rel="stylesheet">
      </head>
      <body>
        <div id="root"></div>
        <script type="module" src="${scriptUri}"></script>
      </body>
      </html>`;
  }
}
