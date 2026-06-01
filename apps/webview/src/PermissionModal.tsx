import React from 'react';
import { PermissionRequest } from '@koala/shared';
import { ShieldAlert } from 'lucide-react';

interface PermissionModalProps {
  request: PermissionRequest;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
}

export function PermissionModal({ request, onApprove, onDeny }: PermissionModalProps) {
  return (
    <div className="flex flex-col gap-2 p-3 border border-[var(--vscode-errorForeground)]/50 bg-[var(--vscode-editor-background)] rounded text-xs mt-2 shadow-sm">
      <div className="flex items-center gap-2 text-[var(--vscode-errorForeground)] font-semibold">
        <ShieldAlert size={16} />
        <span>Permission Required</span>
      </div>
      
      <p className="opacity-80">The agent wants to execute a tool:</p>
      
      <div className="bg-[var(--vscode-textCodeBlock-background)] text-[var(--vscode-textPreformat-foreground)] p-2 rounded font-mono break-all whitespace-pre-wrap">
        {request.description}
      </div>

      <div className="flex gap-2 justify-end mt-1">
        <button 
          onClick={() => onDeny(request.id)}
          className="px-3 py-1 rounded border border-[var(--vscode-focusBorder)]/50 hover:bg-[var(--vscode-toolbar-hoverBackground)]"
        >
          Deny
        </button>
        <button 
          onClick={() => onApprove(request.id)}
          className="px-3 py-1 rounded bg-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-hoverBackground)] text-[var(--vscode-button-foreground)]"
        >
          Approve
        </button>
      </div>
    </div>
  );
}
