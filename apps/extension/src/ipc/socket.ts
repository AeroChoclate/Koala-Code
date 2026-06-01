import * as net from 'net';
import * as fs from 'fs';
import * as vscode from 'vscode';

export function startIPCSocket(context: vscode.ExtensionContext) {
  const socketPath = process.env.ROO_CODE_IPC_SOCKET_PATH || '\\\\.\\pipe\\koala-code-ipc';
  
  // Clean up old socket file if it exists (on Unix, on Windows this is a named pipe)
  if (process.platform !== 'win32' && fs.existsSync(socketPath)) {
    fs.unlinkSync(socketPath);
  }

  const server = net.createServer((client) => {
    client.on('data', (data) => {
      const message = data.toString();
      vscode.window.showInformationMessage(`CLI Request: ${message}`);
      client.write('Acknowledged from VS Code Host\\n');
    });
  });

  server.listen(socketPath, () => {
    console.log(`IPC server listening on ${socketPath}`);
  });

  context.subscriptions.push({
    dispose: () => server.close()
  });
}
