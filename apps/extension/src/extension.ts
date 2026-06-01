import * as vscode from 'vscode';
import { KoalaWebviewProvider } from './webview/provider';
import { startIPCSocket } from './ipc/socket';

export function activate(context: vscode.ExtensionContext) {
  console.log('Koala Code extension is now active!');

  const provider = new KoalaWebviewProvider(context);
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
