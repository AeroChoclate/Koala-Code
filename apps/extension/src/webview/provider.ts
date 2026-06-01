import * as vscode from 'vscode';
import { WebviewMessage, HostMessage, ExtensionSettings, ChatMessage, ExtensionSettingsSchema } from '@koala/shared';
import { KoalaAgent } from '@koala/core';

export class KoalaWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'koalaCode.webview';
  
  private _view?: vscode.WebviewView;
  private _agent?: KoalaAgent;
  private _messages: ChatMessage[] = [];
  private _isProcessing = false;
  
  private _permissionResolvers: Map<string, (approved: boolean) => void> = new Map();

  constructor(private readonly _context: vscode.ExtensionContext) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    const webviewAppUri = vscode.Uri.joinPath(this._context.extensionUri, '..', 'webview', 'dist');
    
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._context.extensionUri, webviewAppUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data: WebviewMessage) => {
      switch (data.type) {
        case 'webview:ready':
          this.syncSettings();
          this.postMessage({ type: 'chat:update', messages: this._messages });
          break;
        case 'settings:get':
          this.syncSettings();
          break;
        case 'settings:save':
          await this.saveSettings(data.settings);
          this.syncSettings();
          break;
        case 'chat:send':
          await this.handleChatSend(data.value);
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

  private async getSettings(): Promise<ExtensionSettings> {
    const raw = this._context.globalState.get('koalaSettings') || {};
    // Ensure raw is parsed correctly
    let settings: ExtensionSettings;
    try {
      settings = ExtensionSettingsSchema.parse(raw);
    } catch (e) {
      // Fallback if parsing fails (e.g. from an old version)
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
    // Deep merge partial settings
    const next = { 
      ...current,
      api: { ...current.api, ...partial.api },
      permissions: { ...current.permissions, ...partial.permissions }
    };
    if (partial.mode) next.mode = partial.mode;
    
    if (partial.api?.apiKey) {
      await this._context.secrets.store('koalaApiKey', partial.api.apiKey);
    }
    
    // Save everything else (except apiKey which shouldn't be in globalState)
    const toSave = JSON.parse(JSON.stringify(next));
    delete toSave.api.apiKey;
    
    await this._context.globalState.update('koalaSettings', toSave);
  }

  private async syncSettings() {
    const settings = await this.getSettings();
    this.postMessage({ type: 'settings:update', settings });
    this._agent = new KoalaAgent({
      provider: settings.api.provider,
      model: settings.api.model,
      apiKey: settings.api.apiKey,
    }, settings.mode);
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
      vscode.window.showErrorMessage("Agent not initialized. Please configure your API key in Settings.");
      return;
    }

    const settings = await this.getSettings();
    if (!settings.api.apiKey) {
      vscode.window.showErrorMessage("No API key configured. Click the ⚙ gear icon to add one.");
      return;
    }
    if (!settings.api.model) {
      vscode.window.showErrorMessage("No model selected. Click the ⚙ gear icon to choose one.");
      return;
    }

    this._isProcessing = true;
    this._messages.push({ role: 'user', content: trimmedInput });
    this._messages.push({ role: 'agent', content: '' });
    this.postMessage({ type: 'chat:update', messages: this._messages });
    this.postMessage({ type: 'agent:status', status: 'working', startedAt: Date.now() });

    try {
      const coreMessages = this._messages
        .filter(m => m.content) // exclude the empty placeholder
        .map(m => ({
          role: m.role === 'agent' ? 'assistant' as const : 'user' as const,
          content: m.content
        }));

      await this._agent.processChat(coreMessages, {
        onChunk: (chunk: string) => {
          if (!chunk) return;

          const current = this._messages[this._messages.length - 1];
          if (current?.role === 'agent') {
            current.content += chunk;
            this.postMessage({ type: 'chat:update', messages: this._messages });
          }
        },
        onRequestPermission: async (request) => {
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
        }
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
