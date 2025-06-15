# Codehooks.io MCP Server (Beta)

## About MCP (Model Context Protocol)

MCP lets AI agents use external tools and services. Each MCP server adds new capabilities - this one gives your AI agent database access, code deployment, and file management.

**The power comes from combining multiple MCP servers:** Your AI agent can use a web scraping MCP to gather data, this Codehooks MCP to store and process it, and an email MCP to send reports - all in one conversation.

## Your AI Agent's Automation & Integration Hub

This MCP server gives your AI agent the ability to automate workflows and integrate systems. Store data, deploy automation scripts, and create persistent processes - all through natural conversation.

## What You Can Ask Your AI To Do

**"Store my customer feedback and make it searchable"**
→ Creates a database, imports your data, adds search indexes, gives you query endpoints

**"Create an API that calculates my monthly expenses from receipts"**
→ Builds the logic, deploys the code, gives you a live URL like `https://your-app.codehooks.io/expenses`

**"Import this CSV of sales data and create summary endpoints"**
→ Uploads 10,000 rows, creates `/sales/monthly` and `/sales/by-region` API endpoints

## Available Tools (21 Total)

**Database & Collections:** query, create, import/export data, add schemas and indexes
**Code Deployment:** Deploy JavaScript serverless functions
**File Operations:** Upload, list, and delete files
**Key-Value Store:** Store settings and preferences with TTL
**System Operations:** View logs and documentation

## Setup

### Get Codehooks Credentials

```bash
coho login
coho add-admintoken
```

### Configure for Claude Desktop

Add to your `claude-settings.json`:

```json
{
  "tools": {
    "codehooks": {
      "type": "mcp",
      "transport": "stdio",
      "command": [
        "docker",
        "run",
        "--rm",
        "-i",
        "-e",
        "CODEHOOKS_PROJECT_NAME=your_project_name",
        "-e",
        "CODEHOOKS_ADMIN_TOKEN=your_admin_token",
        "-e",
        "CODEHOOKS_SPACE=your_space_name",
        "ghcr.io/restdb/codehooks-mcp:latest"
      ]
    }
  }
}
```

### Configure for Cursor

Add to your `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "codehooks": {
      "type": "mcp",
      "transport": "stdio",
      "command": "docker run --rm -i -e CODEHOOKS_PROJECT_NAME=your_project_name -e CODEHOOKS_ADMIN_TOKEN=your_admin_token -e CODEHOOKS_SPACE=your_space_name ghcr.io/restdb/codehooks-mcp:latest"
    }
  }
}
```

Replace `your_project_name`, `your_admin_token`, and `your_space_name` with your actual values.

## Example Usage

**"Create a todo list API"**
Your AI will deploy endpoints, set up a database, and give you working REST API.

**"Import my contacts CSV and make it searchable"**
Your AI will upload the data, create search indexes, and build query endpoints.

**"Monitor my deployed applications"**
Your AI will show real-time logs, performance metrics, and help debug issues.

## Why Use This MCP Server

- **Zero Learning Curve**: Just talk to your AI in natural language
- **Complete Automation**: Database, deployment, monitoring - all handled automatically
- **Perfect Integration Layer**: Works seamlessly with other MCP tools
- **Persistent Memory**: Your AI remembers context across conversations
- **Production Ready**: Built on proven Codehooks.io infrastructure

Start building with your AI agent today - no technical experience required!
