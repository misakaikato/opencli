# OpenCLI

> **Make any website your CLI.**  
> Zero risk · Reuse Chrome login · AI-powered discovery

OpenCLI turns any website into a command-line tool by bridging your Chrome browser through [Playwright MCP](https://github.com/nichochar/playwright-mcp). No passwords stored, no tokens leaked — it just rides your existing browser session.

## ✨ Highlights

- 🌐 **25+ commands, 13 sites** — Bilibili, 知乎, GitHub, Twitter/X, Reddit, V2EX, 小红书, Hacker News…
- 🔐 **Account-safe** — Reuses Chrome's logged-in state; your credentials never leave the browser
- 🤖 **AI Agent ready** — `explore` discovers APIs, `synthesize` generates adapters, `cascade` finds the simplest auth strategy
- 📝 **Declarative YAML** — Most adapters are ~30 lines of YAML pipeline
- 🔌 **TypeScript escape hatch** — Complex adapters (XHR interception, GraphQL) can be written in TS

## 🚀 Quick Start

```bash
npm install
npx tsx src/main.ts list               # See all commands

# Public APIs (no browser required)
npx tsx src/main.ts hackernews top --limit 5
npx tsx src/main.ts github search --keyword "rust"
npx tsx src/main.ts v2ex hot --limit 10

# Browser commands (Chrome + MCP Bridge extension required)
npx tsx src/main.ts bilibili hot --limit 5
npx tsx src/main.ts zhihu hot --limit 5
npx tsx src/main.ts bilibili search --keyword "AI" --limit 5
```

## 📋 Prerequisites

Browser commands need:
1. **Chrome** running with the target site logged in
2. **[Playwright MCP Bridge](https://chromewebstore.google.com/detail/playwright-mcp-bridge/mmlmfjhmonkocbjadbfplnigmagldckm)** extension installed
3. Click the extension icon to approve connection on first use

> 💡 Set `PLAYWRIGHT_MCP_EXTENSION_TOKEN` to auto-approve without clicking.

## 📦 Built-in Commands

| Site | Commands | Mode |
|------|----------|------|
| **bilibili** | `hot` `search` `me` `favorite` `history` `feed` `user-videos` | 🔐 Browser |
| **zhihu** | `hot` `search` `question` | 🔐 Browser |
| **xiaohongshu** | `search` `feed` | 🔐 Browser |
| **twitter** | `trending` | 🔐 Browser |
| **reddit** | `hot` | 🔐 Browser |
| **github** | `trending` `search` | 🔐 / 🌐 |
| **v2ex** | `hot` `latest` `topic` | 🌐 Public |
| **hackernews** | `top` | 🌐 Public |

## 🎨 Output Formats

```bash
opencli bilibili hot -f table   # Default: rich table
opencli bilibili hot -f json    # JSON (pipe to jq, feed to AI)
opencli bilibili hot -f md      # Markdown
opencli bilibili hot -f csv     # CSV
opencli bilibili hot -v         # Verbose: show pipeline steps
```

## 🧠 AI Agent Workflow

```bash
# 1. Deep Explore — discover APIs, infer capabilities, detect framework
opencli explore https://example.com --site mysite

# 2. Synthesize — generate candidate YAML adapters from explore artifacts
opencli synthesize mysite

# 3. Generate — one-shot: explore → synthesize → register
opencli generate https://example.com --goal "hot"

# 4. Strategy Cascade — auto-probe: PUBLIC → COOKIE → HEADER
opencli cascade https://api.example.com/data
```

Explore outputs structured artifacts to `.opencli/explore/<site>/`:
- `manifest.json` — site metadata, framework detection
- `endpoints.json` — scored API endpoints with response schemas
- `capabilities.json` — inferred capabilities with confidence scores
- `auth.json` — authentication strategy recommendations

## 🔧 Create New Commands

See **[SKILL.md](./SKILL.md)** for the full adapter development guide:
- **YAML pipeline** — declare navigate → evaluate → map → limit
- **TypeScript adapter** — for XHR interception, GraphQL, pagination

## 📄 License

MIT
