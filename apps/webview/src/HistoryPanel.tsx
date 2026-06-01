import React from 'react';
import { Clock3, Plus, Search, Trash2, X } from 'lucide-react';
import { ConversationSummary } from '@koala/shared';

type HistoryPanelProps = {
  open: boolean;
  conversations: ConversationSummary[];
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onNewChat: () => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
};

function formatRelativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Recently';
  }

  const diffMs = date.getTime() - Date.now();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  if (Math.abs(diffHours) < 24) {
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(diffHours, 'hour');
  }

  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(diffDays, 'day');
}

export function HistoryPanel({
  open,
  conversations,
  query,
  onQueryChange,
  onClose,
  onNewChat,
  onLoad,
  onDelete,
}: HistoryPanelProps) {
  return (
    <aside
      className={[
        'absolute inset-y-0 right-0 z-40 w-full max-w-sm border-l border-[var(--koala-border)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_92%,black_8%)] shadow-[-24px_0_48px_rgba(0,0,0,0.35)] transition-transform duration-200',
        open ? 'translate-x-0' : 'translate-x-full',
      ].join(' ')}
      aria-hidden={!open}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-[var(--koala-border)] px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white/90">
            <Clock3 size={16} className="text-[var(--koala-accent)]" />
            <span>Chat History</span>
          </div>
          <button onClick={onClose} className="koala-toolbar-button" type="button">
            <X size={16} />
          </button>
        </div>

        <div className="border-b border-[var(--koala-border)] px-4 py-3">
          <button onClick={onNewChat} type="button" className="koala-primary-button mb-3 w-full justify-center">
            <Plus size={16} />
            <span>New Chat</span>
          </button>
          <label className="koala-search-shell">
            <Search size={15} className="text-white/45" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search chats"
              className="koala-search-input"
              type="text"
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {conversations.length === 0 ? (
            <div className="koala-panel rounded-2xl px-4 py-5 text-center text-xs text-white/60">
              No saved chats yet.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {conversations.map((conversation) => (
                <div key={conversation.id} className="koala-history-item">
                  <button
                    type="button"
                    onClick={() => onLoad(conversation.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-sm font-medium text-white/90">{conversation.title}</div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-white/45">
                      <span>{formatRelativeDate(conversation.updatedAt)}</span>
                      <span>•</span>
                      <span>{conversation.messageCount} messages</span>
                    </div>
                    <div className="mt-2 line-clamp-2 text-xs text-white/55">
                      {conversation.lastMessagePreview || 'No preview available'}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(conversation.id)}
                    className="koala-toolbar-button shrink-0"
                    aria-label={`Delete ${conversation.title}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
