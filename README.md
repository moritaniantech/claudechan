<div align="center">

# Claude Chan 🤖

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)](https://workers.cloudflare.com/)
[![Anthropic Claude](https://img.shields.io/badge/Anthropic-Claude-blue.svg)](https://www.anthropic.com/)
[![Slack API](https://img.shields.io/badge/Slack-API-green.svg)](https://api.slack.com/)

Next-generation AI assistant for Slack. Delivering fast and scalable AI conversations through globally distributed data centers.

[Demo](#demo) • [Features](#features) • [Quick Start](#quick-start) • [Setup](#detailed-setup) • [Contributing](#contributing)

</div>

---

## Overview

Claude Chan is a Slack bot powered by Cloudflare Workers and Anthropic's Claude API. It provides low-latency responses and high scalability through global data centers. Conversations are stored in Cloudflare D1, enabling natural dialogue with context awareness.

## Demo

![Claude Chan Demo](docs/images/demo.gif)

## Features

### 🎯 Core Features

- 💬 Natural AI conversations in Slack
- 🧵 Thread-based conversation history
- 📝 Persistent chat storage with D1 database
- 🔒 Secure environment variable management
- ⚡ Fast responses through global data centers

### 🎨 Special Features

- 🌐 Multi-channel support
- 🔄 Context-aware continuous conversations
- 📊 Usage statistics tracking
- 🎭 Customizable AI persona
- ⌨️ Convenient Slack commands

## Technology Stack

### Backend

- [Cloudflare Workers](https://workers.cloudflare.com/)

  - Low-latency execution
  - Global distribution
  - Automatic scaling

- [Cloudflare D1](https://developers.cloudflare.com/d1/)
  - SQLite database optimized for global distribution
  - Fast query processing
  - Automatic backups

### Framework

- [Hono](https://hono.dev/)
  - 💨 Ultra-lightweight and fast
  - 📝 TypeScript-first design
  - 🔌 Middleware ecosystem
  - 🎯 Path parameters and query handling
  - 🔒 Built-in security features

### API Integration

- [Anthropic Claude API](https://www.anthropic.com/)

  - Advanced natural language processing
  - Context awareness
  - Customizable responses

- [Slack Web API](https://api.slack.com/)
  - Real-time messaging
  - Interactive components
  - File sharing capabilities

## System Requirements

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Git

### Account Requirements

- Cloudflare Account
  - Workers enabled (free tier available)
  - D1 database enabled
- Anthropic Account
  - API key
  - Appropriate usage tier
- Slack Workspace Admin
  - Bot creation permissions
  - Scope configuration rights

## Quick Start

```bash
# Clone repository
git clone https://github.com/yourusername/claudechan.git
cd claudechan

# Install dependencies
npm install

# Start development server
npx wrangler dev
```

## Detailed Setup

### 1. Environment Variables

Set the following environment variables in your Cloudflare Workers dashboard:

Required Variables:

- `ANTHROPIC_API_KEY`: Anthropic API key
- `SLACK_BOT_TOKEN`: Slack bot token
- `SLACK_SIGNING_SECRET`: Slack application signing secret
- `SLACK_APP_TOKEN`: Slack application token
- `CLAUDE_MODEL`: Claude model to use (e.g., `claude-3-opus-20240229`)
- `ALLOWED_CHANNELS`: Channel IDs where bot can respond (comma-separated)
- `ALLOWED_USERS`: User IDs allowed to use the bot (comma-separated)

Optional Variables:

- `MAX_TOKENS`: Maximum response tokens (default: 1000)
- `TEMPERATURE`: Response diversity (0-1, default: 0.7)
- `LOG_LEVEL`: Logging level (`debug`, `info`, `warn`, `error`, default: `info`)

### 2. Slack Application Setup

1. Enable Event Subscriptions

   - Set Request URL to `https://your-worker-name.workers.dev/slack/events`
   - Subscribe to events:
     - `message.channels`
     - `message.groups`
     - `message.im`

2. Required Scopes:
   - `chat:write`
   - `channels:history`
   - `groups:history`
   - `im:history`
   - `files:read`
   - `reactions:write`

### 3. Database Setup

```bash
# Create D1 database
npx wrangler d1 create claudechan-db

# Apply schema
npx wrangler d1 execute claudechan-db --local --file=./db/schema.sql
```

### 4. wrangler.toml Configuration

```toml
name = "claudechan"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[ d1_databases ]]
binding = "DB"
database_name = "claudechan-db"
database_id = "your-database-id"
```

## Development

### Local Development

```bash
# Start development server
npx wrangler dev

# Generate TypeScript types
npx wrangler types --env-interface CloudflareBindings

# Type checking
npx tsc --noEmit
```

### Deployment

```bash
# Production deployment
npx wrangler deploy --minify
```

## Troubleshooting

### D1 Connection Issues

- ✅ Verify `wrangler.toml` configuration
- ✅ Check database ID
- ✅ Confirm local database initialization

### Slack Integration Issues

- ✅ Verify environment variables
- ✅ Check application scopes
- ✅ Validate event subscription URL
- ✅ Confirm signing secret match

## Performance Monitoring

- Monitor metrics in Cloudflare dashboard
- Optimize D1 query performance
- Track memory usage
- Monitor response times

## Security Considerations

- 🔒 Proper environment variable management
- 🔑 API key rotation
- 📝 Access log monitoring
- 🛡️ Rate limiting
- 🔐 Slack signature verification

## Contributing

1. Fork the repository
2. Create a feature branch
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. Commit changes
   ```bash
   git commit -m 'Add: new feature'
   ```
4. Push and create PR
   ```bash
   git push origin feature/amazing-feature
   ```

## License

[MIT License](LICENSE) © 2024 moritaniantech

## Author

[@moritaniantech](https://github.com/moritaniantech)

---

<div align="center">

**[Back to Top](#claude-chan-)**

</div>
