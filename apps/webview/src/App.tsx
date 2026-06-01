import React, { useState, useEffect, useRef } from 'react';
import { Settings, Send, Bot, User, Menu } from 'lucide-react';
import { ExtensionSettings, ChatMessage, WebviewMessage, HostMessage, PermissionRequest, AgentMode } from '@koala/shared';
import { SettingsView } from './Settings';
import { PermissionModal } from './PermissionModal';

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

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
  const [agentStatus, setAgentStatus] = useState<'idle' | 'working' | 'waiting'>('idle');
  const [thinkingStartedAt, setThinkingStartedAt] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Send message to extension host
  const vscode = (window as any).vscode;
  const postMessage = (msg: WebviewMessage) => {
    if (vscode) {
      vscode.postMessage(msg);
    }
  };

  useEffect(() => {
    // Notify host we are ready to receive state
    postMessage({ type: 'webview:ready' });
    postMessage({ type: 'settings:get' });

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data as HostMessage;
      switch (msg.type) {
        case 'settings:update':
          setSettings(msg.settings);
          break;
        case 'chat:update':
          setMessages(msg.messages);
          break;
        case 'permission:ask':
          setPermissions(prev => [...prev, msg.request]);
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
  }, [messages, permissions]);

  const handleSend = () => {
    if (!input.trim() || agentStatus !== 'idle') return;
    
    // Optimistic update
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    postMessage({ type: 'chat:send', value: input });
    setInput('');
  };

  const handleSaveSettings = (newSettings: Partial<ExtensionSettings>) => {
    postMessage({ type: 'settings:save', settings: newSettings });
  };

  const handleApprove = (id: string) => {
    setPermissions(prev => prev.filter(p => p.id !== id));
    postMessage({ type: 'permission:approve', id });
  };

  const handleDeny = (id: string) => {
    setPermissions(prev => prev.filter(p => p.id !== id));
    postMessage({ type: 'permission:deny', id });
  };

  if (!settings) {
    return <div className="p-4 text-center text-xs opacity-50">Loading settings...</div>;
  }

  return (
    <div className="flex flex-col h-screen text-[var(--vscode-editor-foreground)] bg-[var(--vscode-editor-background)] text-sm relative">
      {/* Header */}
      <header className="flex items-center justify-between p-3 border-b border-[var(--vscode-focusBorder)]/30 shrink-0">
        <div className="flex items-center gap-2 font-semibold">
          <Bot size={18} className="text-[var(--vscode-textLink-foreground)]" />
          <span>Koala Code</span>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={settings.mode}
            onChange={(e) => handleSaveSettings({ mode: e.target.value as AgentMode })}
            className="bg-transparent border border-[var(--vscode-focusBorder)]/50 rounded px-1 py-0.5 text-xs outline-none"
          >
            <option value="code">Code ▼</option>
            <option value="architect">Architect</option>
            <option value="ask">Ask</option>
            <option value="debug">Debug</option>
            <option value="orchestrator">Orchestrator</option>
          </select>
          <button onClick={() => setShowSettings(true)} className="p-1 hover:bg-[var(--vscode-button-hoverBackground)]/20 rounded">
            <Settings size={16} />
          </button>
          <button className="p-1 hover:bg-[var(--vscode-button-hoverBackground)]/20 rounded">
            <Menu size={16} />
          </button>
        </div>
      </header>

      {/* Task Context */}
      <div className="p-3 border-b border-[var(--vscode-focusBorder)]/20 text-xs text-opacity-80 flex flex-col gap-1 shrink-0 bg-[var(--vscode-sideBar-background)]">
        <div><strong>Provider:</strong> {settings.api.provider}</div>
        <div><strong>Model:</strong> {settings.api.model || 'Not set'}</div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
        {messages.length === 0 && (
          <div className="text-center opacity-50 mt-10 text-xs">
            How can I help you code today?
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className="flex gap-2">
            <div className="mt-1 shrink-0">
              {m.role === 'user' ? <User size={16} /> : <Bot size={16} className="text-[var(--vscode-textLink-foreground)]" />}
            </div>
            <div className="flex-1 whitespace-pre-wrap break-words">{m.content}</div>
          </div>
        ))}
        
        {/* Permission Requests */}
        {permissions.map(req => (
          <PermissionModal 
            key={req.id} 
            request={req} 
            onApprove={handleApprove} 
            onDeny={handleDeny} 
          />
        ))}

        {(agentStatus === 'working' || agentStatus === 'waiting') && (
          <div className="flex gap-2 opacity-70 text-xs items-center py-1">
            <Bot size={16} className="animate-pulse text-[var(--vscode-textLink-foreground)]" />
            <span>{agentStatus === 'waiting' ? 'Waiting for approval' : 'Thinking'}... {thinkingStartedAt && <ThinkingTimer startedAt={thinkingStartedAt} />}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[var(--vscode-focusBorder)]/20 flex gap-2 shrink-0 bg-[var(--vscode-editor-background)]">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={agentStatus === 'idle' ? "Type a message..." : "Agent is busy..."} 
          disabled={agentStatus !== 'idle'}
          className="flex-1 bg-transparent border border-[var(--vscode-focusBorder)]/50 rounded px-3 py-1.5 focus:outline-none focus:border-[var(--vscode-focusBorder)] disabled:opacity-50"
        />
        <button 
          onClick={handleSend}
          disabled={!input.trim() || agentStatus !== 'idle'}
          className="bg-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-50 text-[var(--vscode-button-foreground)] p-1.5 rounded flex items-center justify-center transition-colors"
        >
          <Send size={18} />
        </button>
      </div>

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
