import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Clock3, Plus, Send, Settings, User } from 'lucide-react';
import {
  AgentMode,
  ChatMessage,
  ContextInfo,
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

function formatModeLabel(mode: AgentMode) {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

function formatContext(context: ContextInfo) {
  return [
    context.workspace ? `Workspace: ${context.workspace}` : null,
    context.activeFile ? `File: ${context.activeFile}` : null,
    context.branch ? `Branch: ${context.branch}` : null,
  ].filter(Boolean);
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
  const [agentStatus, setAgentStatus] = useState<'idle' | 'working' | 'waiting'>('idle');
  const [thinkingStartedAt, setThinkingStartedAt] = useState<number | null>(null);
  const [contextInfo, setContextInfo] = useState<ContextInfo>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAgentActive = agentStatus === 'working' || agentStatus === 'waiting';
  const elapsedSeconds = thinkingStartedAt ? Math.floor((Date.now() - thinkingStartedAt) / 1000) : 0;
  const statusMeta = getStatusMeta(agentStatus, elapsedSeconds);
  const contextItems = useMemo(() => formatContext(contextInfo), [contextInfo]);

  const vscode = (window as any).vscode;
  const postMessage = (msg: WebviewMessage) => {
    if (vscode) {
      vscode.postMessage(msg);
    }
  };

  useEffect(() => {
    postMessage({ type: 'webview:ready' });

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
  }, [messages, permissions, agentStatus]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      postMessage({ type: 'chat:history:search', query: searchQuery });
    }, 150);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const handleSend = () => {
    if (!input.trim() || agentStatus !== 'idle') return;
    postMessage({ type: 'chat:send', value: input });
    setInput('');
  };

  const handleSaveSettings = (newSettings: Partial<ExtensionSettings>) => {
    postMessage({ type: 'settings:save', settings: newSettings });
  };

  const handleNewChat = () => {
    postMessage({ type: 'chat:new' });
    setShowHistory(false);
    setSearchQuery('');
  };

  const handleLoadChat = (id: string) => {
    postMessage({ type: 'chat:history:load', id });
  };

  const handleDeleteChat = (id: string) => {
    postMessage({ type: 'chat:history:delete', id });
  };

  const handleApprove = (id: string) => {
    setPermissions((prev) => prev.filter((p) => p.id !== id));
    postMessage({ type: 'permission:approve', id });
  };

  const handleDeny = (id: string) => {
    setPermissions((prev) => prev.filter((p) => p.id !== id));
    postMessage({ type: 'permission:deny', id });
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
              <div className="truncate font-semibold tracking-[0.01em]">Koala Code</div>
              <div className="truncate text-[11px] text-white/55">Persistent agent workspace</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleNewChat} className="koala-toolbar-button" type="button" aria-label="New chat">
              <Plus size={16} />
            </button>
            <button
              onClick={() => {
                setShowHistory(true);
                postMessage({ type: 'chat:history:list' });
              }}
              className="koala-toolbar-button"
              type="button"
              aria-label="Open chat history"
            >
              <Clock3 size={16} />
            </button>
            <button onClick={() => setShowSettings(true)} className="koala-toolbar-button" type="button" aria-label="Open settings">
              <Settings size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="shrink-0 border-b border-[var(--koala-border)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_90%,white_10%)] px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {contextItems.length > 0 ? (
            contextItems.map((item) => (
              <span key={item} className="koala-context-chip">
                {item}
              </span>
            ))
          ) : (
            <span className="koala-context-chip">No workspace context detected</span>
          )}
          <span className="koala-context-chip">{settings.api.provider}</span>
          <span className="koala-context-chip">{settings.api.model || 'No model selected'}</span>
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
              <div>Start a new persisted conversation in your local Koala workspace.</div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'agent' && (
                <div className="koala-panel-strong mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
                  <Bot size={15} className="text-[var(--koala-accent)]" />
                </div>
              )}
              <div
                className={[
                  'max-w-[88%] rounded-2xl border px-4 py-3 whitespace-pre-wrap break-words shadow-[0_12px_32px_rgba(0,0,0,0.18)]',
                  m.role === 'user'
                    ? 'border-[var(--koala-border-strong)] bg-[color:color-mix(in_srgb,var(--vscode-textLink-foreground)_18%,var(--vscode-editor-background)_82%)] text-white'
                    : 'koala-panel text-[var(--vscode-editor-foreground)]',
                ].join(' ')}
              >
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                  {m.role === 'user' ? 'You' : 'Koala'}
                </div>
                <div>{m.content}</div>
              </div>
              {m.role === 'user' && (
                <div className="koala-panel mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
                  <User size={15} className="text-white/80" />
                </div>
              )}
            </div>
          ))}

          {permissions.map((req) => (
            <PermissionModal
              key={req.id}
              request={req}
              onApprove={handleApprove}
              onDeny={handleDeny}
            />
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
        <div className="mx-auto mb-2 flex w-full max-w-3xl flex-wrap gap-2">
          {modeOptions.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => handleSaveSettings({ mode })}
              className={['koala-mode-pill', settings.mode === mode ? 'koala-mode-pill-active' : ''].join(' ')}
            >
              {formatModeLabel(mode)}
            </button>
          ))}
        </div>
        <div className="mx-auto flex w-full max-w-3xl gap-2 rounded-2xl border border-[var(--koala-border)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_86%,white_14%)] p-2 shadow-[0_-10px_30px_rgba(0,0,0,0.12)]">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={agentStatus === 'idle' ? 'Type a message...' : 'Agent is busy...'}
            disabled={agentStatus !== 'idle'}
            className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-3 py-2 text-sm text-[var(--vscode-editor-foreground)] outline-none transition-colors focus:border-[var(--koala-border-strong)] focus:bg-white/3 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || agentStatus !== 'idle'}
            className="inline-flex items-center justify-center rounded-xl border border-[var(--koala-border-strong)] bg-[color:color-mix(in_srgb,var(--vscode-button-background)_78%,white_22%)] px-3 py-2 text-[var(--vscode-button-foreground)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      <HistoryPanel
        open={showHistory}
        conversations={conversations}
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onClose={() => setShowHistory(false)}
        onNewChat={handleNewChat}
        onLoad={handleLoadChat}
        onDelete={handleDeleteChat}
      />

      {showSettings && (
        <SettingsView
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
