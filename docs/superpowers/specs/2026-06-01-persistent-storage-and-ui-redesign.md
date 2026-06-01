# Persistent Storage + UI Redesign

Date: 2026-06-01
Topic: Persistent agent storage, chat history, and webview UI overhaul

## Summary

This design migrates Koala Code's data storage from VS Code `globalState`/`SecretStorage` to a dedicated filesystem directory (`C:\Users\dualt\.cokoala`), adds comprehensive chat history with real-time persistence and search, and redesigns the webview UI with a toolbar header, auto-detected context bar, bottom mode selector, history sidebar, and activity bar icon.

## Goals

- Store all plugin data (settings, chat history) under `C:\Users\dualt\.cokoala` for portability and transparency
- Persist every chat message to disk in real time so no data is lost on crash or close
- Provide a sidebar panel for browsing, searching, and loading past conversations
- Redesign the header as a clean toolbar with action buttons (new chat, history, settings)
- Add an auto-detected context bar showing workspace name, active file, and git branch
- Relocate the agent mode toggle from the header to pill-style buttons above the input
- Add a proper activity bar icon for the extension
- Keep API keys in VS Code SecretStorage (never written to `.cokoala` as plaintext)

## Non-Goals

- Shared storage layer with the CLI app (future refactor into `packages/core`)
- SQLite or any external database dependency
- Theme customization settings UI
- Rich markdown rendering for messages
- Server-side or cloud-synced history

## Current State

### Storage
- Settings stored in `globalState` via `this._context.globalState.get('koalaSettings')`
- API key stored in `SecretStorage` via `this._context.secrets.get('koalaApiKey')`
- Chat messages exist only in the `_messages` array in memory — lost on close

### UI
- Header contains a mode `<select>`, settings gear, and menu button
- A thin provider/model strip shows configuration info
- Messages render as simple rows with avatars
- An animated status card appears during agent activity
- Activity bar icon is declared in `package.json` but the SVG file (`media/icon.svg`) does not exist
- No chat history browsing capability

### Architecture
- Extension host (`apps/extension/src/webview/provider.ts`) handles all state via `KoalaWebviewProvider`
- Webview (`apps/webview/src/App.tsx`) communicates via `postMessage` with defined `WebviewMessage`/`HostMessage` types
- Shared types in `packages/shared/src/index.ts`

## Design

### 1. Storage Architecture

#### Directory Structure

```
C:\Users\dualt\.cokoala\
├── config.json
├── chats/
│   ├── index.json
│   ├── <uuid>.json
│   ├── <uuid>.json
│   └── ...
```

#### StorageService (`apps/extension/src/storage/service.ts`)

New class managing all `.cokoala` file I/O:

- `constructor(basePath: string)` — resolves to `C:\Users\dualt\.cokoala`, creates directories on first use
- `saveConfig(settings)` / `loadConfig()` — reads/writes `config.json`. API key excluded from file; stays in `SecretStorage`
- `createConversation()` — generates a new UUID, creates `chats/<uuid>.json` with empty messages array, updates `index.json`, returns the conversation object
- `appendMessage(conversationId, message)` — reads conversation file, pushes message with ISO timestamp, rewrites file and updates `index.json` entry. Uses a 200ms debounce to coalesce rapid successive appends (e.g. during streaming agent responses) into fewer disk writes
- `listConversations()` — reads `index.json`, returns sorted list (newest first) with id, title, createdAt, messageCount, lastMessagePreview
- `searchConversations(query)` — in-memory substring match over index titles and last message previews
- `loadConversation(id)` — reads `chats/<uuid>.json`, returns full `Conversation` object
- `deleteConversation(id)` — removes conversation file and index entry

#### Data Shapes

```typescript
interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredMessage[];
}

interface StoredMessage {
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
}

interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessagePreview: string;
}
```

#### Config Migration

On extension activation:
1. If `globalState('koalaSettings')` exists and `.cokoala/config.json` does not — read settings from globalState, write to `.cokoala/config.json`, clear globalState
2. If `.cokoala/config.json` exists — use it directly
3. API key remains in `SecretStorage` throughout; never written to `.cokoala`

#### Message Protocol Extensions

New `WebviewMessage` types (webview → extension):

```typescript
| { type: 'chat:history:list' }
| { type: 'chat:history:load'; id: string }
| { type: 'chat:history:search'; query: string }
| { type: 'chat:history:delete'; id: string }
| { type: 'chat:new' }
```

New `HostMessage` types (extension → webview):

```typescript
| { type: 'chat:history:list-result'; conversations: ConversationSummary[] }
| { type: 'chat:history:load-result'; conversation: Conversation }
| { type: 'chat:history:search-result'; conversations: ConversationSummary[] }
| { type: 'context:update'; workspace?: string; activeFile?: string; branch?: string }
```

#### Security

- API key stays in VS Code `SecretStorage` (OS keychain) — never written to disk
- `config.json` contains only non-secret data: provider name, model string, permissions, mode
- `.cokoala` directory inherits standard filesystem permissions (user-only on Windows)

### 2. UI Redesign

#### New Layout (top to bottom)

```
┌─────────────────────────────────────┐
│  HEADER (toolbar)                   │
│  Logo | Title | [New] [History] [⚙]│
├─────────────────────────────────────┤
│  CONTEXT BAR                        │
│  📁 workspace  •  📄 file  •   branch│
├─────────────────────────────────────┤
│  RAINBOW PROGRESS BAR (if active)   │
├─────────────────────────────────────┤
│                                     │
│  MESSAGES AREA (scrollable)         │
│                                     │
│  [Status Card when active]          │
│                                     │
├─────────────────────────────────────┤
│  MODE SELECTOR (pill buttons)       │
│  [Code] [Architect] [Ask] [Debug]   │
│  [Orchestrator]                     │
├─────────────────────────────────────┤
│  INPUT COMPOSER                     │
│  [________________________] [Send]  │
└─────────────────────────────────────┘
```

#### 2a. Header — Toolbar with Actions

**Left:** Koala bot icon (neon glow) + "Koala Code" title + subtle tagline

**Right:** Three icon buttons:
- **New Chat** (plus icon) — starts a fresh conversation, auto-saves current one
- **History** (clock icon) — toggles the history sidebar panel
- **Settings** (gear icon) — opens the existing settings modal

The mode `<select>` is removed from the header. The menu button is removed (its functionality is covered by the three explicit buttons).

#### 2b. Context Bar

Replaces the current provider/model strip. Displays auto-detected workspace context as a single-line strip with dot-separated items:

```
📁 my-project  •  📄 App.tsx  •   main
```

**Data sources:**
- Workspace name: `vscode.workspace.name`
- Active file: `vscode.window.activeTextEditor?.document.fileName` (basename only)
- Git branch: `vscode.extensions.getExtension('vscode.git')` internal API, falling back to `git rev-parse --abbrev-ref HEAD` via the extension host

**Updates:** Pushed from extension to webview whenever the active editor changes, via `onDidChangeActiveTextEditor` listener in the provider.

#### 2c. Activity Bar Icon

The `package.json` already declares the activity bar container with `"icon": "media/icon.svg"`. The file is missing.

Create `apps/extension/media/icon.svg` — a koala-themed icon using `currentColor` for theme compatibility. Works at 16x16 and 24x24 sizes. VS Code handles active/inactive color states automatically.

#### 2d. Bottom Panel — Mode Selector + Input

**Row 1 — Mode Pills:**
- Horizontal row of compact pill buttons: `Code | Architect | Ask | Debug | Orchestrator`
- Active mode gets neon accent highlight; inactive modes are ghost/subtle
- Clicking a pill immediately switches mode via `saveSettings({ mode })`
- Compact vertical footprint

**Row 2 — Input Composer:**
- Same input + send button structure as current
- Updated styling to match the refreshed neon design
- Disabled state while agent is busy

#### 2e. History Sidebar Panel

Toggled by the History button in the header. Slides in from the right, overlaying the webview content:

- **Search bar** at top — filters conversations by title substring
- **Conversation list** — each item shows:
  - Title (auto-generated from first user message, truncated to ~60 chars)
  - Relative date ("2 hours ago", "Yesterday")
  - Message count badge
  - Last message preview (~80 chars)
- **Click** to load conversation into the messages area, closes panel
- **Delete** button (trash icon) per conversation with confirmation
- **New Chat** button at top
- Close (X) button; also closes when History button toggled again

#### 2f. New State in App.tsx

```typescript
const [showHistory, setShowHistory] = useState(false);
const [conversations, setConversations] = useState<ConversationSummary[]>([]);
const [searchQuery, setSearchQuery] = useState('');
const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
const [contextInfo, setContextInfo] = useState<{ workspace?: string; activeFile?: string; branch?: string }>({});
```

#### Chat Lifecycle

**Starting a new chat:**
1. If current conversation has messages, finalize it (update index entry)
2. Generate new UUID, set `activeConversationId`
3. Create new conversation file via extension
4. Clear messages array

**Loading a past conversation:**
1. Request conversation from extension via `chat:history:load`
2. Replace messages array with loaded messages
3. Set `activeConversationId` to loaded conversation's ID
4. Close history panel

**During a conversation:**
1. Each user/agent message is appended to the active conversation file in real time
2. Title auto-generated from first user message (first 60 chars)
3. `index.json` updated on each append

**Agent mode selector:**
1. Mode pills rendered in bottom panel
2. Clicking a pill calls `saveSettings({ mode })`
3. Settings persist to `.cokoala/config.json`

### 3. Files to Create

| File | Purpose |
|------|---------|
| `apps/extension/src/storage/service.ts` | StorageService class for all `.cokoala` I/O |
| `apps/extension/src/storage/migrate.ts` | Config migration from globalState to `.cokoala` |
| `apps/extension/media/icon.svg` | Activity bar icon |
| `apps/webview/src/HistoryPanel.tsx` | History sidebar component |

### 4. Files to Modify

| File | Changes |
|------|---------|
| `packages/shared/src/index.ts` | Add ConversationSummary, StoredMessage types; extend WebviewMessage and HostMessage unions |
| `apps/extension/src/webview/provider.ts` | Instantiate StorageService, wire up new message handlers, add context detection listeners |
| `apps/extension/src/extension.ts` | Call migration on activation |
| `apps/webview/src/App.tsx` | New layout (header, context bar, mode pills, history panel), new state, new message handlers |
| `apps/webview/src/index.css` | New styles for pills, context bar, history panel, updated header |

## Testing and Verification

- Extension builds without errors (`pnpm run build` from workspace root)
- Webview builds without errors (`pnpm run build` in `apps/webview`)
- Settings load from `.cokoala/config.json` after migration
- New conversation creates a JSON file in `.cokoala/chats/`
- Each message appends to the conversation file in real time
- History panel lists conversations, search filters correctly
- Loading a past conversation restores messages in the chat area
- Deleting a conversation removes the file and index entry
- Activity bar icon renders correctly in VS Code sidebar
- Context bar shows workspace name, active file, and git branch
- Mode pills switch mode and persist selection
- Input disabled during agent activity
- Rainbow progress bar visible only during `working`/`waiting`

## Risks and Mitigations

### Risk: Frequent disk writes cause performance issues
Mitigation: Use `fs.writeFile` with a debounced flush (200ms) for message appends. The conversation file is small enough that full rewrites are fast.

### Risk: `.cokoala` directory gets corrupted or manually edited
Mitigation: Validate JSON on read with try/catch. If a conversation file is corrupt, skip it in the index and log a warning. Never fail silently — show a VS Code notification.

### Risk: Git branch detection fails if git extension is not loaded
Mitigation: Graceful fallback — omit branch from context bar if unavailable. No error shown to user.

### Risk: Large chat histories slow down the search
Mitigation: `index.json` is loaded once and kept in memory. Substring search over titles and previews is fast for hundreds of conversations. If history grows to thousands, add pagination later.

### Risk: Activity bar icon SVG does not render well at small sizes
Mitigation: Use simple shapes (geometric koala face or "K" lettermark) with `currentColor`. Test at 16x16 and 24x24.
