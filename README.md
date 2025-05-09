# Codehooks.io MCP Server (under construction 🚧)

This MCP (Model Context Protocol) server provides tools for interacting with codehooks.io projects through AI agents like Claude.

## User Guide

### Quick Start

```bash
docker run -d \
  -e CODEHOOKS_PROJECT_NAME="your_project_name" \
  -e CODEHOOKS_SPACE="dev" \
  -e CODEHOOKS_ADMIN_TOKEN="your_admin_token" \
  ghcr.io/owner/codehooks-mcp:latest
```

#### How to get your admin token

1. Open a terminal window and navigate to your project.
2. Run `coho login` and follow the instructions to login.
3. run the command `coho add-admintoken` to get your admin token.
4. copy the the token.

### Required Environment Variables

- `CODEHOOKS_PROJECT_NAME`: Your Codehooks.io project name
- `CODEHOOKS_SPACE`: Target space (e.g., "dev", "prod")
- `CODEHOOKS_ADMIN_TOKEN`: Your Codehooks.io admin token (found in project settings)

Note: The MCP server uses admin token authentication, so no additional login is required.

### Using with Claude Desktop

Add the following to your `claude-settings.json`:

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
        "CODEHOOKS_SPACE=dev",
        "ghcr.io/owner/codehooks-mcp:latest"
      ]
    }
  }
}
```

### Using with Cursor

Add the following to your `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "codehooks": {
      "type": "mcp",
      "transport": "stdio",
      "command": "docker run --rm -i -e CODEHOOKS_PROJECT_NAME=your_project_name -e CODEHOOKS_ADMIN_TOKEN=your_admin_token -e CODEHOOKS_SPACE=dev ghcr.io/restdb/codehooks-mcp:latest"
    }
  }
}
```

Note: Make sure to replace the environment variables with your actual Codehooks.io project values.

### Testing the Docker Container

1. First, make sure you have your admin token (see "How to get your admin token" section above)

2. Run the container in interactive mode to test:

```bash
docker run --rm -i \
  -e CODEHOOKS_PROJECT_NAME="your_project_name" \
  -e CODEHOOKS_SPACE="dev" \
  -e CODEHOOKS_ADMIN_TOKEN="your_admin_token" \
  ghcr.io/owner/codehooks-mcp:latest
```

3. Once running, you can test it by typing (or pasting) this JSON request:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "list_tools",
  "params": {}
}
```

4. Press Enter twice. The server should respond with a list of available tools.

5. You can then test a specific tool, for example listing collections:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "call_tool",
  "params": {
    "name": "list_collections"
  }
}
```

If you receive proper JSON responses without errors, the MCP server is working correctly.

### Available Tools

The MCP server provides the following tools for interacting with your Codehooks.io project:

1. `query_collection`: Query data from a collection

   - Parameters: collection (required), query (optional), limit (optional)

2. `deploy_code`: Deploy JavaScript code to your project (NOT WORKING YET!)

   - Parameters: filename (required), code (required)


## Implementation Guide

For development and contribution guidelines, please refer to the project's GitHub repository.
