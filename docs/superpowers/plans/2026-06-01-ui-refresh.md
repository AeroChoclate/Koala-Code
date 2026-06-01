# UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the Koala Code webview with a modern neon-accented chat UI, a global rainbow loading bar, and a richer in-thread status card while keeping the existing VS Code-compatible layout and state model.

**Architecture:** Keep the existing single-screen React webview structure centered in `apps/webview/src/App.tsx`, and layer in visual polish through small local helper functions plus targeted CSS additions in `apps/webview/src/index.css`. Reuse the existing `agentStatus` and `thinkingStartedAt` state to drive both a thin header progress bar and a presentational status card without requiring backend protocol changes.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4 utilities, global CSS, Vite, lucide-react

---

## File Structure

### Files to modify
- `apps/webview/src/App.tsx`
  - Keep the existing application shell
  - Add small local helpers for active-state detection and staged loading copy
  - Restyle header, context, messages, status UI, and composer
- `apps/webview/src/index.css`
  - Add shared CSS variables for neon accents and translucent surfaces
  - Add keyframes and utility classes for rainbow progress bars, glow, panel styling, and scrollbar polish

### Files to inspect while implementing
- `apps/webview/package.json`
  - Confirms available frontend scripts: `build` and `lint`
- `package.json`
  - Confirms workspace-level `build`, `lint`, and `typecheck` via Turbo

### Files not in scope
- `packages/shared/src/index.ts`
  - No protocol changes required for this pass
- `apps/extension/src/webview/provider.ts`
  - No HTML bootstrap changes required for this pass
- `apps/cli/src/index.tsx`
  - CLI excluded by spec

## Implementation Notes
- Keep all state in `App.tsx`; do not introduce a new component file unless `App.tsx` becomes materially harder to read.
- Treat staged loading copy as a frontend presentation detail only.
- Continue using VS Code CSS variables as the base layer; neon accents should be additive.
- Preserve current behavior that disables the input while the agent is active.

---

### Task 1: Add shared visual tokens and animations in `index.css`

**Files:**
- Modify: `apps/webview/src/index.css`
- Test: `apps/webview/src/index.css` via webview build in Task 6

- [ ] **Step 1: Replace the minimal stylesheet with a richer token and animation layer**

```css
@import "tailwindcss";

:root {
  --vscode-editor-background: #1e1e1e;
  --vscode-editor-foreground: #d4d4d4;
  --vscode-button-background: #0e639c;
  --vscode-button-foreground: #ffffff;
  --vscode-button-hoverBackground: #1177bb;
  --vscode-focusBorder: #007fd4;
  --vscode-textLink-foreground: #3794ff;
  --vscode-font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --koala-surface: color-mix(in srgb, var(--vscode-editor-background) 82%, white 18%);
  --koala-surface-soft: color-mix(in srgb, var(--vscode-editor-background) 90%, white 10%);
  --koala-surface-strong: color-mix(in srgb, var(--vscode-editor-background) 70%, black 30%);
  --koala-border: color-mix(in srgb, var(--vscode-focusBorder) 28%, transparent);
  --koala-border-strong: color-mix(in srgb, var(--vscode-textLink-foreground) 42%, transparent);
  --koala-accent: var(--vscode-textLink-foreground);
  --koala-accent-soft: color-mix(in srgb, var(--vscode-textLink-foreground) 24%, transparent);
  --koala-glow: color-mix(in srgb, var(--vscode-textLink-foreground) 35%, transparent);
  --koala-rainbow: linear-gradient(90deg, #38bdf8 0%, #60a5fa 16%, #818cf8 32%, #c084fc 48%, #f472b6 64%, #fb7185 80%, #f59e0b 100%);
}

html,
body,
#root {
  height: 100%;
}

body {
  background:
    radial-gradient(circle at top, color-mix(in srgb, var(--koala-accent) 12%, transparent) 0%, transparent 38%),
    var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  font-family: var(--vscode-font-family);
  margin: 0;
  padding: 0;
  overflow: hidden;
}

* {
  box-sizing: border-box;
}

::-webkit-scrollbar {
  width: 10px;
}

::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--vscode-focusBorder) 35%, transparent);
  border-radius: 999px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

@keyframes koala-rainbow-shift {
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 200% 50%;
  }
}

@keyframes koala-pulse-glow {
  0%,
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--koala-glow) 0%, transparent);
  }
  50% {
    box-shadow: 0 0 24px 0 color-mix(in srgb, var(--koala-glow) 55%, transparent);
  }
}

@keyframes koala-status-breathe {
  0%,
  100% {
    opacity: 0.72;
    transform: translateY(0);
  }
  50% {
    opacity: 1;
    transform: translateY(-1px);
  }
}

.koala-panel {
  background: color-mix(in srgb, var(--koala-surface) 92%, transparent);
  border: 1px solid var(--koala-border);
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 8%, transparent);
  backdrop-filter: blur(14px);
}

.koala-panel-strong {
  background: color-mix(in srgb, var(--koala-surface-strong) 88%, transparent);
  border: 1px solid var(--koala-border-strong);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 10%, transparent),
    0 0 24px color-mix(in srgb, var(--koala-glow) 18%, transparent);
}

.koala-rainbow-bar {
  background-image: var(--koala-rainbow);
  background-size: 200% 100%;
  animation: koala-rainbow-shift 2.2s linear infinite;
}

.koala-glow {
  animation: koala-pulse-glow 2.8s ease-in-out infinite;
}

.koala-status-copy {
  animation: koala-status-breathe 2.4s ease-in-out infinite;
}
```

- [ ] **Step 2: Review the stylesheet for scope discipline**

Check that the new classes are limited to the UI refresh needs only:
- `.koala-panel`
- `.koala-panel-strong`
- `.koala-rainbow-bar`
- `.koala-glow`
- `.koala-status-copy`

Expected result: the stylesheet adds reusable visual primitives without introducing unrelated theme systems.

- [ ] **Step 3: Commit the CSS token/animation foundation**

```bash
git add apps/webview/src/index.css
git commit -m "feat: add neon ui tokens for webview refresh"
```

---

### Task 2: Add local helpers and active-state UI structure in `App.tsx`

**Files:**
- Modify: `apps/webview/src/App.tsx`
- Test: `apps/webview/src/App.tsx` via webview build in Task 6

- [ ] **Step 1: Add a staged status copy helper near `ThinkingTimer`**

Insert this helper above `export default function App()`:

```tsx
function getStatusMeta(agentStatus: 'idle' | 'working' | 'waiting', elapsedSeconds: number) {
  if (agentStatus === 'waiting') {
    return {
      title: 'Waiting for approval',
      subtitle: 'Review the pending action to keep the run moving.',
      badge: 'Approval needed',
    };
  }

  const phases = [
    'Reviewing context',
    'Planning response',
    'Polishing output',
  ];

  return {
    title: 'Thinking',
    subtitle: phases[Math.floor(elapsedSeconds / 3) % phases.length],
    badge: 'Agent active',
  };
}
```

- [ ] **Step 2: Track active-state flags and elapsed seconds inside `App`**

Add these lines after `const messagesEndRef = useRef<HTMLDivElement>(null);`:

```tsx
  const isAgentActive = agentStatus === 'working' || agentStatus === 'waiting';
  const elapsedSeconds = thinkingStartedAt ? Math.floor((Date.now() - thinkingStartedAt) / 1000) : 0;
  const statusMeta = getStatusMeta(agentStatus, elapsedSeconds);
```

Then replace the smooth-scroll effect dependency list:

```tsx
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, permissions, agentStatus]);
```

- [ ] **Step 3: Replace the root shell opening with a layered app container**

Replace:

```tsx
    <div className="flex flex-col h-screen text-[var(--vscode-editor-foreground)] bg-[var(--vscode-editor-background)] text-sm relative">
```

With:

```tsx
    <div className="flex h-screen flex-col bg-[var(--vscode-editor-background)] text-sm text-[var(--vscode-editor-foreground)] relative overflow-hidden">
```

- [ ] **Step 4: Commit the helper/state scaffolding**

```bash
git add apps/webview/src/App.tsx
git commit -m "refactor: add webview status ui scaffolding"
```

---

### Task 3: Restyle the header and add the global rainbow activity bar

**Files:**
- Modify: `apps/webview/src/App.tsx`
- Test: `apps/webview/src/App.tsx` via webview build in Task 6

- [ ] **Step 1: Replace the current header block with a polished panel-style header**

Replace the existing header JSX with:

```tsx
      <header className="shrink-0 border-b border-[var(--koala-border)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_82%,black_18%)] px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="koala-panel-strong koala-glow flex h-9 w-9 items-center justify-center rounded-xl">
              <Bot size={18} className="text-[var(--koala-accent)]" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold tracking-[0.01em]">Koala Code</div>
              <div className="text-[11px] text-white/55">Neon-assisted coding workflow</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={settings.mode}
              onChange={(e) => handleSaveSettings({ mode: e.target.value as AgentMode })}
              className="koala-panel rounded-lg px-2 py-1 text-xs outline-none transition-colors hover:border-[var(--koala-border-strong)]"
            >
              <option value="code">Code ▼</option>
              <option value="architect">Architect</option>
              <option value="ask">Ask</option>
              <option value="debug">Debug</option>
              <option value="orchestrator">Orchestrator</option>
            </select>
            <button onClick={() => setShowSettings(true)} className="koala-panel rounded-lg p-2 transition-colors hover:border-[var(--koala-border-strong)] hover:bg-white/5">
              <Settings size={16} />
            </button>
            <button className="koala-panel rounded-lg p-2 transition-colors hover:border-[var(--koala-border-strong)] hover:bg-white/5">
              <Menu size={16} />
            </button>
          </div>
        </div>
      </header>
```

- [ ] **Step 2: Insert a global active-state bar directly below the header**

Add this block immediately after `</header>`:

```tsx
      <div className="h-1 shrink-0 overflow-hidden bg-white/5">
        {isAgentActive && <div className="koala-rainbow-bar h-full w-full shadow-[0_0_16px_var(--koala-glow)]" />}
      </div>
```

- [ ] **Step 3: Restyle the provider/model strip into a compact context panel**

Replace the existing task-context `<div>` with:

```tsx
      <div className="shrink-0 border-b border-[var(--koala-border)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_90%,white_10%)] px-3 py-2 text-xs">
        <div className="koala-panel flex flex-col gap-1 rounded-xl px-3 py-2 text-[11px] text-white/70">
          <div><strong className="text-white/90">Provider:</strong> {settings.api.provider}</div>
          <div><strong className="text-white/90">Model:</strong> {settings.api.model || 'Not set'}</div>
        </div>
      </div>
```

- [ ] **Step 4: Commit the header and top-bar refresh**

```bash
git add apps/webview/src/App.tsx
git commit -m "feat: add modern header and top activity bar"
```

---

### Task 4: Restyle messages and replace the thinking row with a status card

**Files:**
- Modify: `apps/webview/src/App.tsx`
- Test: `apps/webview/src/App.tsx` via webview build in Task 6

- [ ] **Step 1: Replace the message thread wrapper with a more spacious scroll container**

Replace:

```tsx
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
```

With:

```tsx
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
```

Then make sure to add a matching closing `</div>` before the outer thread closes.

- [ ] **Step 2: Replace the empty state and message map with elevated message cards**

Replace the existing empty-state block and `messages.map(...)` block with:

```tsx
        {messages.length === 0 && (
          <div className="koala-panel mx-auto mt-10 max-w-sm rounded-2xl px-5 py-6 text-center text-xs text-white/60">
            <div className="mb-2 text-sm font-medium text-white/85">How can I help you code today?</div>
            <div>Prompt the agent to start a neon-lit workflow.</div>
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
                'max-w-[88%] rounded-2xl px-4 py-3 whitespace-pre-wrap break-words border shadow-[0_12px_32px_rgba(0,0,0,0.18)]',
                m.role === 'user'
                  ? 'border-[var(--koala-border-strong)] bg-[color:color-mix(in_srgb,var(--vscode-textLink-foreground)_18%,var(--vscode-editor-background)_82%)] text-white'
                  : 'koala-panel text-[var(--vscode-editor-foreground)]'
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
```

- [ ] **Step 3: Replace the plain thinking row with a rich status card**

Replace:

```tsx
        {(agentStatus === 'working' || agentStatus === 'waiting') && (
          <div className="flex gap-2 opacity-70 text-xs items-center py-1">
            <Bot size={16} className="animate-pulse text-[var(--vscode-textLink-foreground)]" />
            <span>{agentStatus === 'waiting' ? 'Waiting for approval' : 'Thinking'}... {thinkingStartedAt && <ThinkingTimer startedAt={thinkingStartedAt} />}</span>
          </div>
        )}
```

With:

```tsx
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
```

- [ ] **Step 4: Close the new inner thread wrapper correctly**

Before the existing outer thread closing `</div>`, ensure there is one extra closing tag:

```tsx
        <div ref={messagesEndRef} />
        </div>
      </div>
```

Expected result: one inner container closes before the outer scroll container closes.

- [ ] **Step 5: Commit the message-thread refresh**

```bash
git add apps/webview/src/App.tsx
git commit -m "feat: add polished message cards and status panel"
```

---

### Task 5: Restyle the composer and loading settings shell

**Files:**
- Modify: `apps/webview/src/App.tsx`
- Test: `apps/webview/src/App.tsx` via webview build in Task 6

- [ ] **Step 1: Replace the loading-settings fallback with a styled panel**

Replace:

```tsx
  if (!settings) {
    return <div className="p-4 text-center text-xs opacity-50">Loading settings...</div>;
  }
```

With:

```tsx
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
```

- [ ] **Step 2: Replace the input composer block with a polished panel composer**

Replace the existing input section with:

```tsx
      <div className="shrink-0 border-t border-[var(--koala-border)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_88%,black_12%)] px-3 py-3">
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
```

- [ ] **Step 3: Commit the composer and loading-shell polish**

```bash
git add apps/webview/src/App.tsx
git commit -m "feat: polish webview composer and loading shell"
```

---

### Task 6: Verify formatting, build, lint, and workspace type health

**Files:**
- Test: `apps/webview/src/App.tsx`
- Test: `apps/webview/src/index.css`
- Test: `apps/webview/package.json`
- Test: `package.json`

- [ ] **Step 1: Run the webview build**

Run:

```bash
pnpm --filter koala-webview build
```

Expected: Vite build completes successfully and outputs assets into `apps/webview/dist`.

- [ ] **Step 2: Run the webview lint script**

Run:

```bash
pnpm --filter koala-webview lint
```

Expected: ESLint exits successfully with no warnings promoted to errors.

- [ ] **Step 3: Run workspace typecheck**

Run:

```bash
pnpm typecheck
```

Expected: Turbo completes typecheck tasks without introducing new TypeScript errors in workspace packages.

- [ ] **Step 4: Smoke-check the implemented behavior in the code**

Confirm the final `App.tsx` contains all of the following:
- `isAgentActive` gate for both `working` and `waiting`
- a top rainbow bar below the header
- a rich status card replacing the old plain thinking row
- styled message cards for both `user` and `agent`
- disabled composer behavior preserved

Expected: all acceptance-criteria-related UI hooks are present in code.

- [ ] **Step 5: Commit the verified UI refresh**

```bash
git add apps/webview/src/App.tsx apps/webview/src/index.css
git commit -m "feat: refresh koala webview ui"
```

---

## Self-Review Checklist
- Spec coverage:
  - Global rainbow loading bar: covered in Task 3
  - Rich in-thread status card: covered in Task 4
  - Message presentation refresh: covered in Task 4
  - Header/context polish: covered in Task 3
  - Composer polish: covered in Task 5
  - Build/lint/type verification: covered in Task 6
- Placeholder scan:
  - No TODO/TBD placeholders included
  - Each code-editing step includes concrete replacement code
  - Each verification step includes exact commands and expected outcomes
- Type consistency:
  - `agentStatus` remains `'idle' | 'working' | 'waiting'`
  - `ThinkingTimer` continues to receive `startedAt: number`
  - `getStatusMeta` returns `title`, `subtitle`, and `badge` used directly by the status card
