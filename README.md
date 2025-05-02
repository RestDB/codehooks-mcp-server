# Codehooks.io MCP Server

This MCP (Model Context Protocol) server provides tools for interacting with codehooks.io projects through AI agents like Claude.

## User Guide

### Quick Start

```bash
docker run -d \
  -e CODEHOOKS_PROJECT_ID="your_project_id" \
  -e CODEHOOKS_ADMIN_TOKEN="your_admin_token" \
  -e CODEHOOKS_SPACE="dev" \
  ghcr.io/owner/codehooks-mcp:latest
```

### Required Environment Variables

- `CODEHOOKS_PROJECT_ID`: Your Codehooks.io project ID
- `CODEHOOKS_ADMIN_TOKEN`: Your Codehooks.io admin token (found in project settings)
- `CODEHOOKS_SPACE`: Target space (e.g., "dev", "prod")

Note: The MCP server uses admin token authentication, so no additional login is required.

### Using with Claude Desktop

Add the following to your `
