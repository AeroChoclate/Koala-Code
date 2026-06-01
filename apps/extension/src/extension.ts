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
