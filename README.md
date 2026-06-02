# 🐨 Koala Code

<div align="center">
  <img src="https://img.shields.io/badge/Version-1.0.0-blue?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/VS%20Code-Extension-green?style=for-the-badge&logo=visualstudiocode" alt="VS Code Extension" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="License" />
</div>

---

## 📖 What is Koala Code?

Koala Code is a powerful VS Code extension that brings AI-assisted coding directly into your editor. It's designed to be your intelligent programming companion, capable of reading, writing, and executing code while maintaining context across your entire workspace.

Think of it as your personal AI pair programmer that can:
- 📝 **Read and analyze** your codebase
- ✍️ **Write and modify** files with precision
- ⚡ **Execute commands** to test and build your project
- 💾 **Remember context** across sessions with persistent conversations
- 🎯 **Operate in multiple modes** (Code, Architect, Ask, Debug, Orchestrator)

---

## 🎯 Why We Built This

We created Koala Code because we wanted our own version of AI coding assistants like Roo Code / Cline — but with a few key differences:

- **Full control** - We wanted complete transparency over what the AI can do
- **Customizable permissions** - Fine-grained control over file reads, writes, and command execution
- **Context awareness** - Better tracking of workspace state, active files, and git branches
- **Session management** - Persistent conversations with history and summarization
- **Modern UI** - A beautiful, polished interface that feels native to VS Code

While tools like Roo Code are excellent, we wanted something tailored to our workflow with features like:
- Auto-summarization at context limits
- Message feedback collection
- Granular context usage tracking
- Session summary exports

---

## ✨ Features

### Core Capabilities
| Feature | Description |
|---------|-------------|
| 🤖 **AI Agent** | Powered by leading LLMs (OpenAI, Anthropic, Gemini, OpenRouter) |
| 📂 **File Operations** | Read and write files with permission controls |
| 🖥️ **Command Execution** | Run terminal commands with approval workflows |
| 💬 **Persistent Chat** | Conversations saved across VS Code sessions |
| 📊 **Context Tracking** | Visual indicator showing token usage vs. model limits |

### User Experience
| Feature | Description |
|---------|-------------|
| 🎨 **Modern UI** | Beautiful, responsive interface with smooth animations |
| 📋 **Copy Messages** | One-click copy for any message in the conversation |
| 👍 **Message Feedback** | Rate responses with thumbs up/down |
| 📝 **Session Summaries** | Auto-prompt to save summaries when starting new tasks |
| ⚠️ **Auto-Summarize** | Warning when context reaches 80% capacity |
| 🕐 **Chat History** | Searchable history with previews and metadata |
| 🎛️ **Mode Selection** | Switch between Code, Architect, Ask, Debug, or Orchestrator modes |

---

## 🚀 Installation

### Option 1: VS Code Marketplace (Recommended)
Visit our website to download and install Koala Code:

🌐 **[Download Koala Code](https://koalacode.co.uk)**

Once installed, reload VS Code and look for the Koala icon in your activity bar.

### Option 2: Manual Installation (Developers)
```bash
# Clone the repository
git clone https://github.com/Ashton/koala-code.git
cd koala-code

# Install dependencies
pnpm install

# Build the project
pnpm run build

# Package the extension (requires vsce)
npx vsce package

# Install the .vsix file in VS Code
code --install-extension koala-code-1.0.0.vsix
```

---

## ⚙️ Setup

1. **Open Koala Code** - Click the Koala icon in the VS Code activity bar
2. **Configure Provider** - Go to Settings → Provider tab
3. **Select AI Provider** - Choose from OpenRouter, Anthropic, OpenAI, or Gemini
4. **Enter API Key** - Your key is stored securely in VS Code's secret storage
5. **Choose Model** - Select your preferred model (e.g., `anthropic/claude-3.5-sonnet`)
6. **Set Permissions** - Configure auto-approve settings for file operations and commands
7. **Start Coding** - Type your first message and let Koala help!

---

## 🤝 Contributing

We welcome contributions to Koala Code! Here's how you can help:

### Development Setup

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/koala-code.git
cd koala-code

# Install dependencies
pnpm install

# Start development mode (watches for changes)
pnpm run dev
```

### Project Structure
```
koala-code/
├── apps/
│   ├── cli/          # Command-line interface
│   ├── extension/    # VS Code extension host
│   └── webview/      # UI (React + Tailwind CSS)
├── packages/
│   ├── core/         # AI agent logic and tools
│   └── shared/       # Shared types and utilities
└── docs/             # Documentation and specs
```

### Making Changes

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the existing code style
   - Add types for new features
   - Test your changes thoroughly

3. **Build and test**
   ```bash
   pnpm run build
   pnpm run lint
   pnpm run typecheck
   ```

4. **Submit a Pull Request**
   - Describe what your change does
   - Reference any related issues
   - Include screenshots for UI changes

### Code Style
- **TypeScript** - Strict mode enabled
- **React** - Functional components with hooks
- **Tailwind CSS** - For styling
- **Zod** - For runtime type validation

### Reporting Issues

Found a bug or have a feature request? Please open an issue on GitHub with:
- Clear description of the problem/request
- Steps to reproduce (for bugs)
- Expected vs. actual behavior
- Screenshots if applicable

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 💬 Community

- **Website:** [https://koalacode.co.uk](https://koalacode.co.uk)
- **Issues:** [GitHub Issues](https://github.com/Ashton/koala-code/issues)

---

## 🙏 Acknowledgments

- Inspired by tools like Roo Code, Cline, and other AI coding assistants
- Built with [VS Code Extension API](https://code.visualstudio.com/api)
- Powered by [Vercel AI SDK](https://sdk.vercel.ai/)
- UI components from [Lucide Icons](https://lucide.dev/)

---

<div align="center">
  <p>Built with ❤️ by the Koala Code team</p>
  <p><em>"Code smarter, not harder."</em></p>
</div>
