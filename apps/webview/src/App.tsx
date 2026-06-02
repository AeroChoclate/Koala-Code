import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, Plus, Send, Settings, User, Copy, Check, ThumbsUp, ThumbsDown } from 'lucide-react';
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
import { ContextUsageBar } from './ContextUsageBar';

const KoalaIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[var(--koala-accent)]">
    <path d="M7 6.5C7 4.57 8.57 3 10.5 3C11.55 3 12.5 3.47 13.14 4.2C13.49 4.07 13.87 4 14.26 4C16.03 4 17.46 5.43 17.46 7.2C17.46 7.42 17.43 7.64 17.39 7.86C18.98 8.58 20 10.16 20 12C20 14.76 17.76 17 15 17H9C6.24 17 4 14.76 4 12C4 10.15 5.04 8.56 6.64 7.85C6.52 7.42 7 7.03 7 6.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="9.25" cy="10.75" r="1" fill="currentColor"/>
    <circle cx="14.75" cy="10.75" r="1" fill="currentColor"/>
    <path d="M10 13.75C10.47 14.4 11.19 14.75 12 14.75C12.81 14.75 13.53 14.4 14 13.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

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
  const [showSessionSummaryPrompt, setShowSessionSummaryPrompt] = useState(false);
  const [sessionSummaryConversationId, setSessionSummaryConversationId] = useState<string | null>(null);
  const [sessionSummaryMessages, setSessionSummaryMessages] = useState<ChatMessage[]>([]);
  const [showAutoSummaryPrompt, setShowAutoSummaryPrompt] = useState(false);
  const [autoSummaryConversationId, setAutoSummaryConversationId] = useState<string | null>(null);
  const [autoSummaryMessages, setAutoSummaryMessages] = useState<ChatMessage[]>([]);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  const [messageFeedback, setMessageFeedback] = useState<Record<number, 'positive' | 'negative'>>({});
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
        case 'session:summary:prompt':
          setSessionSummaryConversationId(msg.conversationId);
          setSessionSummaryMessages(msg.messages);
          setShowSessionSummaryPrompt(true);
          break;
        case 'session:auto-summary:prompt':
          setAutoSummaryConversationId(msg.conversationId);
          setAutoSummaryMessages(msg.messages);
          setShowAutoSummaryPrompt(true);
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

  const handleSessionSummaryYes = () => {
    const summaryContent = sessionSummaryMessages
      .map(m => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.content}`)
      .join('\n\n');
    
    postMessage({ 
      type: 'session:summary:save', 
      content: summaryContent,
      conversationId: sessionSummaryConversationId || ''
    });
    setShowSessionSummaryPrompt(false);
    setSessionSummaryConversationId(null);
    setSessionSummaryMessages([]);
  };

  const handleSessionSummaryNo = () => {
    postMessage({ type: 'session:summary:dismiss' });
    setShowSessionSummaryPrompt(false);
    setSessionSummaryConversationId(null);
    setSessionSummaryMessages([]);
  };

  const handleAutoSummarizeYes = () => {
    const summaryContent = autoSummaryMessages
      .map(m => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.content}`)
      .join('\n\n');
    
    postMessage({ 
      type: 'session:summary:save', 
      content: summaryContent,
      conversationId: autoSummaryConversationId || ''
    });
    setShowAutoSummaryPrompt(false);
    setAutoSummaryConversationId(null);
    setAutoSummaryMessages([]);
  };

  const handleAutoSummarizeNo = () => {
    setShowAutoSummaryPrompt(false);
    setAutoSummaryConversationId(null);
    setAutoSummaryMessages([]);
  };

  const handleCopyMessage = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageIndex(index);
      setTimeout(() => setCopiedMessageIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  };

  const handleMessageFeedback = (index: number, rating: 'positive' | 'negative') => {
    setMessageFeedback(prev => ({
      ...prev,
      [index]: prev[index] === rating ? undefined : rating
    }));
    postMessage({ type: 'message:feedback', messageIndex: index, rating });
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
              <KoalaIcon />
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

      {settings.api.model && (
        <ContextUsageBar 
          messages={messages} 
          model={settings.api.model} 
          onAutoSummarize={(percentage) => {
            if (settings.sessionSummary?.enabled && !showAutoSummaryPrompt) {
              postMessage({ 
                type: 'session:auto-summary:prompt', 
                conversationId: sessionSummaryConversationId || '',
                messages: messages
              });
            }
          }} 
        />
      )}

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
            <div key={i} className={`group flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'agent' && (
                <div className="koala-panel-strong mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
                  <KoalaIcon />
                </div>
              )}
              <div className="relative">
                <div
                  className={[
                    'max-w-[88%] rounded-2xl border px-4 py-3 whitespace-pre-wrap break-words shadow-[0_12px_32px_rgba(0,0,0,0.18)]',
                    m.role === 'user'
                      ? 'border-[var(--koala-border-strong)] bg-[color:color-mix(in_srgb,var(--vscode-textLink-foreground)_18%,var(--vscode-editor-background)_82%)] text-white'
                      : 'koala-panel text-[var(--vscode-editor-foreground)]',
                  ].join(' ')}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                      {m.role === 'user' ? 'You' : 'Koala'}
                    </span>
                    <div className="flex items-center gap-1">
                      {m.role === 'agent' && (
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMessageFeedback(i, 'positive');
                            }}
                            className={`rounded-md p-1 transition-all hover:bg-white/10 ${
                              messageFeedback[i] === 'positive' ? 'text-green-400' : 'text-white/45'
                            }`}
                            title="Good response"
                          >
                            <ThumbsUp size={12} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMessageFeedback(i, 'negative');
                            }}
                            className={`rounded-md p-1 transition-all hover:bg-white/10 ${
                              messageFeedback[i] === 'negative' ? 'text-red-400' : 'text-white/45'
                            }`}
                            title="Bad response"
                          >
                            <ThumbsDown size={12} />
                          </button>
                        </div>
                      )}
                      <button
                        onClick={() => handleCopyMessage(m.content, i)}
                        className="invisible group-hover:visible inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] transition-all hover:bg-white/10"
                        title="Copy message"
                      >
                        {copiedMessageIndex === i ? (
                          <>
                            <Check size={12} className="text-green-400" />
                            <span className="text-green-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span className="text-white/45">Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <div>{m.content}</div>
                </div>
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
                      <KoalaIcon />
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

      {showSessionSummaryPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="koala-panel-strong mx-4 w-full max-w-md rounded-2xl border border-[var(--koala-border)] p-6 shadow-2xl">
            <div className="mb-4 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--vscode-button-background)]/20">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[var(--vscode-button-background)]">
                  <path d="M7 6.5C7 4.57 8.57 3 10.5 3C11.55 3 12.5 3.47 13.14 4.2C13.49 4.07 13.87 4 14.26 4C16.03 4 17.46 5.43 17.46 7.2C17.46 7.42 17.43 7.64 17.39 7.86C18.98 8.58 20 10.16 20 12C20 14.76 17.76 17 15 17H9C6.24 17 4 14.76 4 12C4 10.15 5.04 8.56 6.64 7.85C6.52 7.42 7 7.03 7 6.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="9.25" cy="10.75" r="1" fill="currentColor"/>
                  <circle cx="14.75" cy="10.75" r="1" fill="currentColor"/>
                  <path d="M10 13.75C10.47 14.4 11.19 14.75 12 14.75C12.81 14.75 13.53 14.4 14 13.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <h3 className="mb-1 text-lg font-semibold text-[var(--vscode-editor-foreground)]">
                Save Session Summary?
              </h3>
              <p className="text-sm text-[var(--vscode-descriptionForeground)]">
                Would you like to save a summary of this conversation to the session-summaries folder?
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSessionSummaryNo}
                className="flex-1 rounded-xl border border-[var(--vscode-input-border)] bg-[var(--vscode-button-secondaryBackground)] px-4 py-2.5 text-sm font-medium text-[var(--vscode-button-secondaryForeground)] transition-all hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
              >
                No, Skip
              </button>
              <button
                onClick={handleSessionSummaryYes}
                className="flex-1 rounded-xl bg-[var(--vscode-button-background)] px-4 py-2.5 text-sm font-medium text-[var(--vscode-button-foreground)] transition-all hover:bg-[var(--vscode-button-hoverBackground)]"
              >
                Yes, Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showAutoSummaryPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="koala-panel-strong mx-4 w-full max-w-md rounded-2xl border border-[var(--koala-border)] p-6 shadow-2xl">
            <div className="mb-4 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--vscode-warningForeground)]/20">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[var(--vscode-warningForeground)]">
                  <path d="M12 9V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="17" r="1" fill="currentColor"/>
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="mb-1 text-lg font-semibold text-[var(--vscode-editor-foreground)]">
                Context Usage at 80%
              </h3>
              <p className="text-sm text-[var(--vscode-descriptionForeground)]">
                Your conversation is using 80% of the available context window. Would you like to save a summary before continuing?
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleAutoSummarizeNo}
                className="flex-1 rounded-xl border border-[var(--vscode-input-border)] bg-[var(--vscode-button-secondaryBackground)] px-4 py-2.5 text-sm font-medium text-[var(--vscode-button-secondaryForeground)] transition-all hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
              >
                Continue Without Saving
              </button>
              <button
                onClick={handleAutoSummarizeYes}
                className="flex-1 rounded-xl bg-[var(--vscode-button-background)] px-4 py-2.5 text-sm font-medium text-[var(--vscode-button-foreground)] transition-all hover:bg-[var(--vscode-button-hoverBackground)]"
              >
                Save Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
