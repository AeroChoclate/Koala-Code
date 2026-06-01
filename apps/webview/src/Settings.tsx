import React, { useState } from 'react';
import { ExtensionSettings, AIProvider } from '@koala/shared';
import { X } from 'lucide-react';

interface SettingsProps {
  settings: ExtensionSettings;
  onSave: (settings: Partial<ExtensionSettings>) => void;
  onClose: () => void;
}

export function SettingsView({ settings, onSave, onClose }: SettingsProps) {
  const [provider, setProvider] = useState<AIProvider>(settings.api.provider);
  const [model, setModel] = useState(settings.api.model);
  const [apiKey, setApiKey] = useState(settings.api.apiKey || '');
  const [autoRead, setAutoRead] = useState(settings.permissions?.autoApproveFileRead || false);
  const [autoWrite, setAutoWrite] = useState(settings.permissions?.autoApproveFileWrite || false);
  const [autoCommand, setAutoCommand] = useState(settings.permissions?.autoApproveCommandExecution || false);

  const handleSave = () => {
    onSave({
      api: { provider, model, apiKey },
      permissions: {
        autoApproveFileRead: autoRead,
        autoApproveFileWrite: autoWrite,
        autoApproveCommandExecution: autoCommand
      }
    });
    onClose();
  };

  return (
    <div className="absolute inset-0 bg-[var(--vscode-editor-background)] flex flex-col z-50">
      <div className="flex items-center justify-between p-3 border-b border-[var(--vscode-focusBorder)]/30">
        <h2 className="font-semibold text-[var(--vscode-editor-foreground)]">Settings</h2>
        <button onClick={onClose} className="p-1 hover:bg-[var(--vscode-button-hoverBackground)]/20 rounded">
          <X size={16} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="font-semibold text-xs">AI Provider</label>
          <select 
            value={provider}
            onChange={(e) => setProvider(e.target.value as AIProvider)}
            className="bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded px-2 py-1"
          >
            <option value="openrouter">OpenRouter</option>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-semibold text-xs">Model</label>
          <input 
            type="text" 
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded px-2 py-1 outline-none focus:border-[var(--vscode-focusBorder)]"
            placeholder="e.g. anthropic/claude-3.5-sonnet"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-semibold text-xs">API Key</label>
          <input 
            type="password" 
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded px-2 py-1 outline-none focus:border-[var(--vscode-focusBorder)]"
            placeholder="sk-..."
          />
        </div>

        <div className="border-t border-[var(--vscode-focusBorder)]/30 my-2"></div>
        <h3 className="font-semibold text-xs text-[var(--vscode-textPreformat-foreground)]">Permissions</h3>
        
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={autoRead} onChange={(e) => setAutoRead(e.target.checked)} />
          Auto-approve file reads
        </label>
        
        <label className="flex items-center gap-2 text-xs cursor-pointer text-[var(--vscode-errorForeground)]">
          <input type="checkbox" checked={autoWrite} onChange={(e) => setAutoWrite(e.target.checked)} />
          Auto-approve file writes (Dangerous)
        </label>
        
        <label className="flex items-center gap-2 text-xs cursor-pointer text-[var(--vscode-errorForeground)]">
          <input type="checkbox" checked={autoCommand} onChange={(e) => setAutoCommand(e.target.checked)} />
          Auto-approve commands (Dangerous)
        </label>
      </div>

      <div className="p-3 border-t border-[var(--vscode-focusBorder)]/30 flex justify-end gap-2">
        <button 
          onClick={onClose}
          className="px-3 py-1.5 rounded text-[var(--vscode-button-secondaryForeground)] bg-[var(--vscode-button-secondaryBackground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
        >
          Cancel
        </button>
        <button 
          onClick={handleSave}
          className="px-3 py-1.5 rounded text-[var(--vscode-button-foreground)] bg-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-hoverBackground)]"
        >
          Save
        </button>
      </div>
    </div>
  );
}
