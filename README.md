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

### Get Codehooks Admin Token (keep it secret!)

```bash
coho login
coho add-admintoken
```

### Create MCP Server Script

Create a folder for your MCP server scripts:

```bash
mkdir ~/mcp-servers
cd ~/mcp-servers
```

**For macOS/Linux** - Create `codehooks.sh`:

```bash
#!/bin/bash

# Set PATH to include common Docker locations
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"

exec docker run --rm -i \
  -e CODEHOOKS_PROJECT_NAME=your_project_name \
  -e CODEHOOKS_ADMIN_TOKEN=your_admin_token \
  -e CODEHOOKS_SPACE=your_space_name \
  ghcr.io/restdb/codehooks-mcp:latest
```

Make it executable:

```bash
chmod +x ~/mcp-servers/codehooks.sh
```

**For Windows** - Create `codehooks.bat`:

```batch
@echo off
docker run --rm -i ^
  -e CODEHOOKS_PROJECT_NAME=your_project_name ^
  -e CODEHOOKS_ADMIN_TOKEN=your_admin_token ^
  -e CODEHOOKS_SPACE=your_space_name ^
  ghcr.io/restdb/codehooks-mcp:latest
```

Replace `your_project_name`, `your_admin_token`, and `your_space_name` with your actual values.

### Configure for Claude Desktop

Add to your `claude_desktop_config.json`:

**macOS/Linux:**

```json
{
  "mcpServers": {
    "codehooks": {
      "command": "/Users/username/mcp-servers/codehooks.sh"
    }
  }
}
```

**Windows:**

```json
{
  "mcpServers": {
    "codehooks": {
      "command": "C:\\Users\\username\\mcp-servers\\codehooks.bat"
    }
  }
}
```

### Configure for Cursor

Add to your `~/.cursor/mcp.json`:

**macOS/Linux:**

```json
{
  "mcpServers": {
    "codehooks": {
      "command": "/Users/username/mcp-servers/codehooks.sh"
    }
  }
}
```

**Windows:**

```json
{
  "mcpServers": {
    "codehooks": {
      "command": "C:\\Users\\username\\mcp-servers\\codehooks.bat"
    }
  }
}
```

Replace `username` with your actual username.

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
