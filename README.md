# Codehooks.io MCP Server

An MCP (Model Context Protocol) server that provides AI agents with database operations, serverless code deployment, and file management capabilities on the Codehooks.io platform.

## Available functionality

### Database & Collections

- Query and update collections (including metadata) with filters and sorting
- Create and manage collections
- Import/export data (JSON,JSONL,CSV)
- Add schemas and indexes, cap collections

### Code Deployment

- Deploy JavaScript serverless functions

### File Operations

- Upload files to cloud storage
- List and browse files
- Delete files
- Inspect file metadata

### Key-Value Store

- Store key-value pairs
- Retrieve one or many key-value pairs
- Delete key-value pairs
- Set time-to-live (TTL) for key-value pairs

### System Operations

- View application logs
- Access API documentation (local documentation for the MCP agent)

## Setup

The MCP server supports flexible configuration - from zero-config (everything via conversation) to pre-configured environment variables.

### Option 1: Zero Configuration (Recommended)

The simplest setup - no environment variables needed. The AI agent will guide you through authentication.

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "codehooks": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "ghcr.io/restdb/codehooks-mcp:latest"]
    }
  }
}
```

**Cursor** (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "codehooks": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "ghcr.io/restdb/codehooks-mcp:latest"]
    }
  }
}
```

When you start a conversation, the AI will:
1. Ask for your admin token (you get this by running `coho add-admintoken` in your terminal)
2. Ask for your project path and read the `config.json` to get project and space settings

### Option 2: Pre-configured Admin Token

Set your admin token once in the config, and only configure the project per-conversation.

First, get your admin token:

```bash
coho login
coho add-admintoken
```

Then add to your MCP config:

```json
{
  "mcpServers": {
    "codehooks": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "CODEHOOKS_ADMIN_TOKEN=your_token_here", "ghcr.io/restdb/codehooks-mcp:latest"]
    }
  }
}
```

The AI will still use `set_project` to configure which project to work with based on your project's `config.json`.

### Option 3: Shell Script (for multiple projects)

Create a shell script for easier management.

**macOS/Linux** - Create `~/mcp-servers/codehooks.sh`:

```bash
#!/bin/bash
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"

exec docker run --rm -i \
  --pull always \
  -e CODEHOOKS_ADMIN_TOKEN=your_admin_token \
  ghcr.io/restdb/codehooks-mcp:latest
```

Make it executable: `chmod +x ~/mcp-servers/codehooks.sh`

**Windows** - Create `codehooks.bat`:

```batch
@echo off
docker run --rm -i ^
  --pull always ^
  -e CODEHOOKS_ADMIN_TOKEN=your_admin_token ^
  ghcr.io/restdb/codehooks-mcp:latest
```

Then reference the script in your MCP config:

```json
{
  "mcpServers": {
    "codehooks": {
      "command": "/Users/username/mcp-servers/codehooks.sh"
    }
  }
}
```

### How Authentication Works

The MCP server uses two setup tools that the AI agent calls automatically:

| Tool | Purpose | Source |
|------|---------|--------|
| `set_admin_token` | Authenticate with Codehooks | User provides token from `coho add-admintoken` |
| `set_project` | Select project and space | AI reads from your project's `config.json` |

**Typical conversation flow:**

```
You: "Help me deploy a new API to my codehooks project at ~/myproject"

AI: I'll help you with that. First, I need to configure the project.
    [Reads ~/myproject/config.json]
    [Calls set_project with project and space from config.json]

    Now I can help you deploy. What would you like the API to do?
```

If the admin token isn't configured:

```
You: "Query my codehooks database"

AI: I need an admin token first. Please run this in your terminal:

    coho add-admintoken

    Then paste the token here.

You: "abc123-xyz789..."

AI: [Calls set_admin_token]
    Token configured! Now, which project would you like to work with?
```

### Project Configuration

Every Codehooks project has a `config.json` file with this structure:

```json
{
  "project": "myproject-abcd",
  "space": "dev"
}
```

The AI agent reads this file to configure which project to work with. Just tell the AI where your project is located.

## Example Requests

- "Build a complete survey system: create a database, deploy an API to collect responses, and add search/analytics endpoints"
- "Set up a real-time inventory tracker: import my product CSV, create stock update webhooks, and build low-stock alerts"
- "Build a webhook processing pipeline: receive webhooks from multiple sources, transform and validate data, then trigger automated actions"
- "Build a content management system: create file upload endpoints, set up a metadata database, and deploy content delivery APIs"
- "Set up automated data backups: export my collections to JSON files, store them with timestamps, and create restoration endpoints"

## How These Examples Work

### Complete Survey System

**The AI agent would:**

1. **Create collections** (`surveys`, `responses`) for data storage
2. **Add schemas** for data validation and structure
3. **Deploy JavaScript endpoints** like `POST /surveys` and `GET /surveys/:id/analytics`
4. **Create indexes** on response fields for fast searching and analytics

### Real-time Inventory Tracker

**The AI agent would:**

1. **Import your CSV** to populate the `products` collection
2. **Deploy webhook handlers** for `POST /inventory/update` and `GET /inventory/low-stock`
3. **Set up key-value storage** for alert thresholds and settings
4. **Create indexes** on SKU and stock levels for real-time queries

### Webhook Processing Pipeline

**The AI agent would:**

1. **Deploy webhook receivers** like `POST /webhooks/stripe` and `POST /webhooks/github`
2. **Create collections** for `webhook_logs`, `processed_events`, and `failed_events`
3. **Set up data transformation** rules and validation schemas for each webhook source
4. **Use key-value store** for rate limiting and duplicate detection with TTL
5. **Deploy action triggers** that send emails, update databases, or call other APIs based on webhook data

### Content Management System

**The AI agent would:**

1. **Create collections** for `content`, `media`, and `users`
2. **Deploy file upload endpoints** with `POST /upload` and `GET /content/:id`
3. **Upload and manage static files** for content delivery
4. **Store metadata** linking files to content records with search indexes

### Automated Data Backups

**The AI agent would:**

1. **Export collections** to JSON format with timestamps
2. **Upload backup files** to cloud storage automatically
3. **Deploy restoration APIs** like `GET /backups` and `POST /restore/:backup-id`
4. **Store backup metadata** in key-value store for tracking and management

Each example demonstrates how multiple MCP tools work together to create complete, production-ready systems through natural conversation with your AI agent.

## Security Researchers

We thank the following individuals for responsible disclosure and helping improve the security of this project:

- [Liran Tal](https://lirantal.com) – Reported a command injection vulnerability in the `query_collection` tool (May 2025)

## License

This project is licensed under the MIT License.
