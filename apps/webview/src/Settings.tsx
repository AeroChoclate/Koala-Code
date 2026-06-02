import React, { useState } from 'react';
import { ExtensionSettings, AIProvider } from '@koala/shared';
import { X, Shield, ChevronRight, FileText } from 'lucide-react';

const KoalaIcon = (props: { size?: number }) => (
  <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[var(--vscode-button-background)]">
    <path d="M7 6.5C7 4.57 8.57 3 10.5 3C11.55 3 12.5 3.47 13.14 4.2C13.49 4.07 13.87 4 14.26 4C16.03 4 17.46 5.43 17.46 7.2C17.46 7.42 17.43 7.64 17.39 7.86C18.98 8.58 20 10.16 20 12C20 14.76 17.76 17 15 17H9C6.24 17 4 14.76 4 12C4 10.15 5.04 8.56 6.64 7.85C6.52 7.42 7 7.03 7 6.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="9.25" cy="10.75" r="1" fill="currentColor"/>
    <circle cx="14.75" cy="10.75" r="1" fill="currentColor"/>
    <path d="M10 13.75C10.47 14.4 11.19 14.75 12 14.75C12.81 14.75 13.53 14.4 14 13.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

type SettingsTab = 'provider' | 'permissions' | 'session';

interface SettingsProps {
  settings: ExtensionSettings;
  onSave: (settings: Partial<ExtensionSettings>) => void;
  onClose: () => void;
}

export function SettingsView({ settings, onSave, onClose }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('provider');
  const [provider, setProvider] = useState<AIProvider>(settings.api.provider);
  const [model, setModel] = useState(settings.api.model);
  const [apiKey, setApiKey] = useState(settings.api.apiKey || '');
  const [autoRead, setAutoRead] = useState(settings.permissions?.autoApproveFileRead || false);
  const [autoWrite, setAutoWrite] = useState(settings.permissions?.autoApproveFileWrite || false);
  const [autoCommand, setAutoCommand] = useState(settings.permissions?.autoApproveCommandExecution || false);
  const [sessionSummaryEnabled, setSessionSummaryEnabled] = useState(settings.sessionSummary?.enabled || false);

  const handleSave = () => {
    onSave({
      api: { provider, model, apiKey },
      permissions: {
        autoApproveFileRead: autoRead,
        autoApproveFileWrite: autoWrite,
        autoApproveCommandExecution: autoCommand
      },
      sessionSummary: {
        enabled: sessionSummaryEnabled
      }
    });
    onClose();
  };

  return (
    <div className="absolute inset-0 bg-[var(--vscode-editor-background)] flex flex-col z-50">
      <div className="px-5 py-4 border-b border-[var(--vscode-focusBorder)]/20 bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_95%,white_5%)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[color:color-mix(in_srgb,var(--vscode-button-background)_20%,transparent)] flex items-center justify-center">
              <KoalaIcon />
            </div>
            <div>
              <h2 className="font-semibold text-[var(--vscode-editor-foreground)] text-sm tracking-wide">Settings</h2>
              <p className="text-[11px] text-[var(--vscode-descriptionForeground)] mt-0.5">Configure your AI assistant</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-[var(--vscode-button-hoverBackground)]/20 rounded-lg transition-all duration-200"
          >
            <X size={16} className="text-[var(--vscode-foreground)]/60" />
          </button>
        </div>
      </div>

      <div className="flex gap-1 p-1 mx-4 mt-4 bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_90%,black_10%)] rounded-xl border border-[var(--vscode-focusBorder)]/10">
        <button
          onClick={() => setActiveTab('provider')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'provider'
              ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]'
              : 'text-[var(--vscode-tab-inactiveForeground)] hover:text-[var(--vscode-tab-activeForeground)]'
          }`}
        >
          <KoalaIcon size={14} />
          Provider
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'permissions'
              ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]'
              : 'text-[var(--vscode-tab-inactiveForeground)] hover:text-[var(--vscode-tab-activeForeground)]'
          }`}
        >
          <Shield size={14} />
          Permissions
        </button>
        <button
          onClick={() => setActiveTab('session')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'session'
              ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]'
              : 'text-[var(--vscode-tab-inactiveForeground)] hover:text-[var(--vscode-tab-activeForeground)]'
          }`}
        >
          <FileText size={14} />
          Session
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto px-4 py-5">
        {activeTab === 'provider' && (
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[11px] font-semibold text-[var(--vscode-descriptionForeground)] uppercase tracking-wider">
                <KoalaIcon size={12} />
                AI Provider
              </label>
              <select 
                value={provider}
                onChange={(e) => setProvider(e.target.value as AIProvider)}
                className="w-full bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-lg px-3 py-2.5 text-xs outline-none focus:border-[var(--vscode-focusBorder)]"
              >
                <option value="openrouter">OpenRouter</option>
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[11px] font-semibold text-[var(--vscode-descriptionForeground)] uppercase tracking-wider">
                <ChevronRight size={12} />
                Model
              </label>
              <input 
                type="text" 
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-lg px-3 py-2.5 text-xs outline-none focus:border-[var(--vscode-focusBorder)]"
                placeholder="e.g. anthropic/claude-3.5-sonnet"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[11px] font-semibold text-[var(--vscode-descriptionForeground)] uppercase tracking-wider">
                <Shield size={12} />
                API Key
              </label>
              <input 
                type="password" 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-lg px-3 py-2.5 text-xs outline-none focus:border-[var(--vscode-focusBorder)]"
                placeholder="sk-..."
              />
            </div>

            <div className="mt-6 p-3 rounded-lg bg-[color:color-mix(in_srgb,var(--vscode-button-background)_8%,transparent)] border border-[var(--vscode-button-background)]/20">
              <p className="text-[11px] text-[var(--vscode-descriptionForeground)] leading-relaxed">
                Your API key is stored securely in VS Code's secret storage. We never store your credentials in plain text.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'permissions' && (
          <div className="space-y-5">
            <div className="space-y-1">
              <h3 className="flex items-center gap-2 text-[11px] font-semibold text-[var(--vscode-descriptionForeground)] uppercase tracking-wider">
                <Shield size={12} />
                Permission Settings
              </h3>
              <p className="text-[11px] text-[var(--vscode-descriptionForeground)]/70 mt-1">
                Control what actions the AI can perform automatically
              </p>
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 rounded-lg border border-[var(--vscode-input-border)] hover:border-[var(--vscode-focusBorder)]/50 transition-all cursor-pointer">
                <div className="mt-0.5">
                  <input 
                    type="checkbox" 
                    checked={autoRead} 
                    onChange={(e) => setAutoRead(e.target.checked)}
                    className="w-4 h-4 rounded border-[var(--vscode-checkbox-border)]"
                  />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-medium text-[var(--vscode-foreground)]">Auto-approve file reads</span>
                  <p className="text-[11px] text-[var(--vscode-descriptionForeground)] mt-0.5">
                    Allow the AI to read files without asking for permission
                  </p>
                </div>
              </label>
              
              <label className="flex items-start gap-3 p-3 rounded-lg border border-[var(--vscode-input-border)] hover:border-[var(--vscode-errorForeground)]/50 transition-all cursor-pointer">
                <div className="mt-0.5">
                  <input 
                    type="checkbox" 
                    checked={autoWrite} 
                    onChange={(e) => setAutoWrite(e.target.checked)}
                    className="w-4 h-4 rounded border-[var(--vscode-checkbox-border)]"
                  />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-medium text-[var(--vscode-errorForeground)]">Auto-approve file writes</span>
                  <p className="text-[11px] text-[var(--vscode-descriptionForeground)] mt-0.5">
                    Allow the AI to modify files without confirmation. Use with caution.
                  </p>
                </div>
              </label>
              
              <label className="flex items-start gap-3 p-3 rounded-lg border border-[var(--vscode-input-border)] hover:border-[var(--vscode-errorForeground)]/50 transition-all cursor-pointer">
                <div className="mt-0.5">
                  <input 
                    type="checkbox" 
                    checked={autoCommand} 
                    onChange={(e) => setAutoCommand(e.target.checked)}
                    className="w-4 h-4 rounded border-[var(--vscode-checkbox-border)]"
                  />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-medium text-[var(--vscode-errorForeground)]">Auto-approve commands</span>
                  <p className="text-[11px] text-[var(--vscode-descriptionForeground)] mt-0.5">
                    Allow the AI to execute terminal commands without approval. Potentially dangerous.
                  </p>
                </div>
              </label>
            </div>

            <div className="mt-6 p-3 rounded-lg bg-[color:color-mix(in_srgb,var(--vscode-errorForeground)_8%,transparent)] border border-[var(--vscode-errorForeground)]/20">
              <p className="text-[11px] text-[var(--vscode-errorForeground)]/90 leading-relaxed">
                <strong>Warning:</strong> Auto-approving writes and commands can be dangerous. Only enable these if you trust the AI's decisions completely.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'session' && (
          <div className="space-y-5">
            <div className="space-y-1">
              <h3 className="flex items-center gap-2 text-[11px] font-semibold text-[var(--vscode-descriptionForeground)] uppercase tracking-wider">
                <FileText size={12} />
                Session Summary
              </h3>
              <p className="text-[11px] text-[var(--vscode-descriptionForeground)]/70 mt-1">
                Save a summary of your coding session when starting a new task
              </p>
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 rounded-lg border border-[var(--vscode-input-border)] hover:border-[var(--vscode-focusBorder)]/50 transition-all cursor-pointer">
                <div className="mt-0.5">
                  <input 
                    type="checkbox" 
                    checked={sessionSummaryEnabled} 
                    onChange={(e) => setSessionSummaryEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-[var(--vscode-checkbox-border)]"
                  />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-medium text-[var(--vscode-foreground)]">Enable session summary</span>
                  <p className="text-[11px] text-[var(--vscode-descriptionForeground)] mt-0.5">
                    Prompt to save a session summary when starting a new chat or task
                  </p>
                </div>
              </label>
            </div>

            <div className="mt-6 p-3 rounded-lg bg-[color:color-mix(in_srgb,var(--vscode-button-background)_8%,transparent)] border border-[var(--vscode-button-background)]/20">
              <p className="text-[11px] text-[var(--vscode-descriptionForeground)] leading-relaxed">
                When enabled, you'll be prompted to save a summary of your conversation before starting a new task. Summaries are saved to a "session-summaries" folder in your project.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-[var(--vscode-focusBorder)]/20 bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_95%,white_5%)] flex justify-end gap-3">
        <button 
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-[var(--vscode-button-secondaryForeground)] bg-[var(--vscode-button-secondaryBackground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] text-xs font-medium"
        >
          Cancel
        </button>
        <button 
          onClick={handleSave}
          className="px-4 py-2 rounded-lg text-[var(--vscode-button-foreground)] bg-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-hoverBackground)] text-xs font-medium"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}
