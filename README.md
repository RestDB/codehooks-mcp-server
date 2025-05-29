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

2. `deploy_code`: Deploy JavaScript code to your project

   - Parameters: files (required), main (optional), projectId (optional), spaceId (optional)
   - **Code Generation**: You can generate Codehooks.io backend code using the comprehensive ChatGPT prompt template available at: https://codehooks.io/docs/chatgpt-backend-api-prompt
   - The prompt template provides examples for REST APIs, NoSQL database operations, key-value store, worker queues, job scheduling, and more

### Query Syntax

The `query_collection` tool supports multiple query formats:

#### 1. URL-style queries (simple)

```
name=John&age=25
status=active
```

#### 2. Regex queries

```
name=/^Jo/
email=/.*@example\.com$/
```

#### 3. MongoDB-style JSON queries (advanced)

For complex queries with comparison operators, use JSON format:

```json
{"name": "John", "age": {"$gt": 25}}
{"status": "active", "created": {"$gte": "2024-01-01"}}
{"tags": {"$in": ["important", "urgent"]}}
{"age": {"$gte": 18, "$lt": 65}}
```

**Supported MongoDB operators:**

- `$gt`, `$gte` - Greater than (equal)
- `$lt`, `$lte` - Less than (equal)
- `$ne` - Not equal
- `$in`, `$nin` - In/not in array
- `$exists` - Field exists
- `$regex` - Regular expression

**Examples:**

Find users older than 70 with last name "Hughes":

```json
{ "Last Name": "Hughes", "Date of birth": { "$lt": "1954-01-01" } }
```

Find active users in specific cities:

```json
{ "status": "active", "city": { "$in": ["New York", "London", "Tokyo"] } }
```

Find records where email field exists:

```json
{ "email": { "$exists": true } }
```

#### Practical Example

Testing the JSON query functionality:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "call_tool",
  "params": {
    "name": "query_collection",
    "arguments": {
      "collection": "users",
      "query": "{\"Last Name\": \"Hughes\", \"Date of birth\": {\"$lt\": \"1954-01-01\"}}",
      "pretty": true,
      "limit": 10
    }
  }
}
```

This query finds all users with last name "Hughes" born before 1954 (over 70 years old).

## Code Generation for Deploy

### Using ChatGPT Prompt Template

The `deploy_code` tool can deploy JavaScript backend code to your Codehooks.io project. To generate code that's compatible with the Codehooks.io platform, you can use the comprehensive prompt template available at [Codehooks.io ChatGPT Prompt Documentation](https://codehooks.io/docs/chatgpt-backend-api-prompt).

#### What the Prompt Template Provides:

- **Complete backend development guidelines** for Codehooks.io
- **Database operations** using the built-in NoSQL document database
- **REST API endpoints** with proper routing
- **Key-value store** implementation examples
- **Worker queues** and background job scheduling
- **Validation schemas** using Zod, Yup, or JSON Schema
- **Error handling** and logging best practices

#### Example Usage:

1. Copy the prompt template from the [documentation](https://codehooks.io/docs/chatgpt-backend-api-prompt)
2. Add your specific requirements at the bottom
3. Use the generated code with the `deploy_code` tool

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "call_tool",
  "params": {
    "name": "deploy_code",
    "arguments": {
      "files": [
        {
          "path": "index.js",
          "content": "// Generated code from ChatGPT prompt template\nimport { app } from 'codehooks-js';\n\napp.get('/hello', (req, res) => {\n  res.json({ message: 'Hello, world!' });\n});\n\nexport default app.init();"
        },
        {
          "path": "package.json",
          "content": "{\n  \"name\": \"my-codehooks-app\",\n  \"version\": \"1.0.0\",\n  \"dependencies\": {\n    \"codehooks-js\": \"latest\"\n  }\n}"
        }
      ],
      "main": "index"
    }
  }
}
```

This approach ensures your generated code follows Codehooks.io best practices and is ready for deployment.

## Implementation Guide

For development and contribution guidelines, please refer to the project's GitHub repository.
