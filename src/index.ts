#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    ListToolsRequestSchema,
    CallToolRequestSchema,
    ErrorCode,
    McpError,
    CompleteRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { promisify } from "util";
import { execFile as execFileCallback } from "child_process";
import { promises as fs } from 'fs';
import path from 'path';

const execFile = promisify(execFileCallback);

// Configuration and types
interface CodehooksConfig {
    projectId: string;
    space: string;
    adminToken: string;
}

const config: CodehooksConfig = {
    projectId: process.env.CODEHOOKS_PROJECT_NAME || "",
    space: process.env.CODEHOOKS_SPACE || "dev",
    adminToken: process.env.CODEHOOKS_ADMIN_TOKEN || "",
};

// Tool schemas with proper typing
const queryCollectionSchema = z.object({
    collection: z.string(),
    query: z.string().optional(),
    count: z.boolean().optional(),
    delete: z.boolean().optional(),
    update: z.string().optional(),
    replace: z.string().optional(),
    useindex: z.string().optional(),
    start: z.string().optional(),
    end: z.string().optional(),
    limit: z.number().optional(),
    fields: z.string().optional(),
    sort: z.string().optional(),
    offset: z.number().optional(),
    enqueue: z.string().optional(),
    reverse: z.boolean().optional(),
    csv: z.boolean().optional(),
    jsonl: z.boolean().optional()
});

const deployCodeSchema = z.object({
    files: z.array(z.object({
        path: z.string(),
        content: z.string()
    })),
    main: z.string().optional(),
    json: z.boolean().optional(),
    projectId: z.string().optional(),
    spaceId: z.string().optional()
});

const fileUploadSchema = z.object({
    content: z.string().describe("File content as text or base64"),
    encoding: z.enum(["text", "base64"]).optional().default("text").describe("Content encoding type"),
    target: z.string().describe("Target path/filename on server")
});

const fileDeleteSchema = z.object({
    filename: z.string().optional().describe("Delete file with match on absolute path/filename. Use this or 'match'."),
    match: z.string().optional().describe("Delete multiple files that match regular expression to a file path. Use this or 'filename'."),
    dryrun: z.boolean().optional().describe("Output files to delete without performing the action")
});

const fileListSchema = z.object({
    path: z.string().optional().describe("Path to list files from"),
});

const createIndexSchema = z.object({
    collection: z.string().describe("Collection name"),
    index: z.string().describe("Field(s) to add to query index"),
});

const dropIndexSchema = z.object({
    collection: z.string().describe("Collection name"),
    index: z.string().describe("Field(s) to remove from query index"),
});

const createCollectionSchema = z.object({
    collection: z.string().describe("Name of collection to create"),
});

const dropCollectionSchema = z.object({
    collection: z.string().describe("Name of collection to drop"),
});

const schemaSchema = z.object({
    collection: z.string().describe("Collection name"),
    schema: z.string().describe("JSON schema to add"),
});

const removeSchemaSchema = z.object({
    collection: z.string().describe("Collection to remove schema from"),
});

const capCollectionSchema = z.object({
    collection: z.string().describe("Collection name"),
    cap: z.number().describe("Maximum number of documents"),
});

const uncapCollectionSchema = z.object({
    collection: z.string().describe("Collection to remove cap from"),
});

const importSchema = z.object({
    filepath: z.string().optional().describe("File path to import from (optional if content is provided)"),
    content: z.string().optional().describe("File content to import (JSON or CSV data)"),
    collection: z.string().describe("Collection to import into"),
    separator: z.string().optional().describe("CSV separator character"),
    encoding: z.string().optional().describe("File encoding"),
});

const exportSchema = z.object({
    collection: z.string().describe("Collection to export"),
    filepath: z.string().optional().describe("File to save export data (optional, will return content if not specified)"),
    csv: z.boolean().optional().describe("Export to CSV format"),
    jsonl: z.boolean().optional().describe("Export to JSONL format")
});

const kvGetSchema = z.object({
    key: z.string().optional().default("*").describe("Key to match, or key* to fetch list"),
    keyspace: z.string().optional().describe("Keyspace to scan"),
    text: z.boolean().optional().describe("Output info as text line"),
});

const kvSetSchema = z.object({
    key: z.string().describe("Key to set"),
    val: z.string().describe("Value to set"),
    keyspace: z.string().optional().describe("Keyspace to use"),
    ttl: z.number().optional().describe("Time to live in millis for value"),
    json: z.boolean().optional().describe("Output info as JSON (not table)"),
});

const kvDelSchema = z.object({
    key: z.string().describe("Key to delete"),
    keyspace: z.string().optional().describe("Keyspace to use"),
    json: z.boolean().optional().describe("Output info as JSON (not table)"),
});

const logSchema = z.object({
    tail: z.number().optional().default(100).describe("Chop log to n lines"),
    follow: z.boolean().optional().describe("Keep log stream open"),
    context: z.string().optional().describe("Filter log on: jobhooks, queuehooks, routehooks, datahooks, auth"),
});

const docsSchema = z.object({});

const collectionSchema = z.object({
    project: z.string().optional().describe("Project name"),
    json: z.boolean().optional().describe("JSON output format"),
    sys: z.boolean().optional().describe("Show system collections")
});

// Add type inference
type QueryCollectionArgs = z.infer<typeof queryCollectionSchema>;
type DeployCodeArgs = z.infer<typeof deployCodeSchema>;
type FileUploadArgs = z.infer<typeof fileUploadSchema>;
type FileDeleteArgs = z.infer<typeof fileDeleteSchema>;
type FileListArgs = z.infer<typeof fileListSchema>;
type CreateIndexArgs = z.infer<typeof createIndexSchema>;
type DropIndexArgs = z.infer<typeof dropIndexSchema>;
type CreateCollectionArgs = z.infer<typeof createCollectionSchema>;
type DropCollectionArgs = z.infer<typeof dropCollectionSchema>;
type SchemaArgs = z.infer<typeof schemaSchema>;
type RemoveSchemaArgs = z.infer<typeof removeSchemaSchema>;
type CapCollectionArgs = z.infer<typeof capCollectionSchema>;
type UncapCollectionArgs = z.infer<typeof uncapCollectionSchema>;
type ImportArgs = z.infer<typeof importSchema>;
type ExportArgs = z.infer<typeof exportSchema>;
type KvGetArgs = z.infer<typeof kvGetSchema>;
type KvSetArgs = z.infer<typeof kvSetSchema>;
type KvDelArgs = z.infer<typeof kvDelSchema>;
type LogArgs = z.infer<typeof logSchema>;
type DocsArgs = z.infer<typeof docsSchema>;
type CollectionArgs = z.infer<typeof collectionSchema>;

// Tool definitions with JSON Schema for tools/list
const tools = [
    {
        name: "query_collection",
        description: "Query data from a collection. Supports URL-style, regex, and MongoDB-style JSON queries with comparison operators. Can also query system collections like '_hooks' which contains deployment metadata including available API endpoints. Using delete, update or replace is very powerful but also dangerous, so use with caution.",
        schema: queryCollectionSchema,
        inputSchema: {
            type: "object",
            properties: {
                collection: { type: "string", description: "Collection name. Use '_hooks' to query deployment metadata and discover available API endpoints." },
                query: { type: "string", description: "Query expression. Supports multiple formats: URL-style ('name=Polly&type=Parrot'), regex ('name=/^po/'), or MongoDB-style JSON ('{\"name\": \"Polly\", \"age\": {\"$gt\": 5}}' for complex queries with operators like $gt, $lt, $gte, $lte, $ne, $in, $nin, $exists, $regex). To get the latest deployment info with API endpoints, use: collection='_hooks', limit=1, reverse=true (check the routehooks property for the available API endpoints)" },
                count: { type: "boolean", description: "Count query results" },
                delete: { type: "boolean", description: "Delete all items from query result" },
                update: { type: "string", description: "Patch all items from query result with JSON string '{...}'" },
                replace: { type: "string", description: "Replace all items from query result with JSON string '{...}'" },
                useindex: { type: "string", description: "Use an indexed field to scan data in query" },
                start: { type: "string", description: "Start value for index scan" },
                end: { type: "string", description: "End value for index scan" },
                limit: { type: "number", description: "Limit query result. Use limit=1 and reverse to get latest deployment from _hooks collection" },
                fields: { type: "string", description: "Comma separated list of fields to include" },
                sort: { type: "string", description: "Comma separated list of fields to sort by. Use '_id' to sort by creation time" },
                offset: { type: "number", description: "Skip items before returning data in query result" },
                enqueue: { type: "string", description: "Add query result to queue topic" },
                reverse: { type: "boolean", description: "Scan index in reverse order. Use with sort='_id' to get newest records first" },
                csv: { type: "boolean", description: "Output data in CSV format" },
                jsonl: { type: "boolean", description: "Output data in JSONL format" }
            },
            required: ["collection"]
        }
    },
    {
        name: "deploy_code",
        description: "Deploy JavaScript code to Codehooks.io project. \n\nMINIMAL WORKING EXAMPLE:\n```javascript\nimport { app } from 'codehooks-js';\n\napp.get('/hello', (req, res) => {\n  res.json({ message: 'Hello, world!' });\n});\n\n// MANDATORY: bind to serverless runtime\nexport default app.init();\n```\n\nINSTANT CRUD BACKEND:\n```javascript\nimport { app } from 'codehooks-js';\n\n// Creates complete CRUD API for any collection (no schema required)\napp.crudlify();\n\nexport default app.init();\n```\n\nKEY REQUIREMENTS:\n- Always import from 'codehooks-js'\n- Always end with `export default app.init();`\n- Use app.get(), app.post(), app.put(), app.delete() for routes\n- For database: `const conn = await Datastore.open(); conn.insertOne(collection, data);`\n- Use app.crudlify() to create complete CRUD backend with no schema required\n- Package.json will be auto-generated if not provided\n\nDOCUMENTATION:\n- Use 'docs' tool for more information \n- Online ChatGPT prompt: https://codehooks.io/docs/chatgpt-backend-api-prompt\n- Online Workflow API: https://codehooks.io/docs/workflow-api\n- LLM-optimized docs: https://codehooks.io/llms.txt and https://codehooks.io/llms-full.txt\n\nNote: Codehooks.io has CORS built-in by default, so no additional CORS middleware is needed.",
        schema: deployCodeSchema,
        inputSchema: {
            type: "object",
            properties: {
                files: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            path: { type: "string", description: "File path relative to project root (e.g. 'index.js', 'src/utils.js')" },
                            content: { type: "string", description: "File content" }
                        },
                        required: ["path", "content"]
                    },
                    description: "Array of files to deploy"
                },
                main: { type: "string", description: "Application main file (defaults to 'index')" },
                json: { type: "boolean", description: "Output JSON format" },
                projectId: { type: "string", description: "Project ID" },
                spaceId: { type: "string", description: "Space ID", default: "dev" }
            },
            required: ["files"]
        }
    },
    {
        name: "file_upload",
        description: "Upload files to server",
        schema: fileUploadSchema,
        inputSchema: {
            type: "object",
            properties: {
                content: { type: "string", description: "File content as text or base64" },
                encoding: { type: "string", enum: ["text", "base64"], default: "text", description: "Content encoding type" },
                target: { type: "string", description: "Target path/filename on server" },
            },
            required: ["target", "content"],
            description: "Upload file content to server with specified target path"
        }
    },
    {
        name: "file_delete",
        description: "Delete a file from server",
        schema: fileDeleteSchema,
        inputSchema: {
            type: "object",
            properties: {
                filename: { type: "string", description: "Delete file with match on absolute path/filename. Use this or 'match'." },
                match: { type: "string", description: "Delete multiple files that match regular expression to a file path. Use this or 'filename'." },
                dryrun: { type: "boolean", description: "Output files to delete without performing the action" }
            }
        }
    },
    {
        name: "file_list",
        description: "List files from server",
        schema: fileListSchema,
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to list files from" }
            }
        }
    },
    {
        name: "create_index",
        description: "Add field(s) to a query index",
        schema: createIndexSchema,
        inputSchema: {
            type: "object",
            properties: {
                collection: { type: "string", description: "Collection name" },
                index: { type: "string", description: "Field(s) to add to query index" }
            },
            required: ["collection", "index"]
        }
    },
    {
        name: "drop_index",
        description: "Remove field(s) from a query index",
        schema: dropIndexSchema,
        inputSchema: {
            type: "object",
            properties: {
                collection: { type: "string", description: "Collection name" },
                index: { type: "string", description: "Field(s) to remove from query index" }
            },
            required: ["collection", "index"]
        }
    },
    {
        name: "create_collection",
        description: "Create a new collection",
        schema: createCollectionSchema,
        inputSchema: {
            type: "object",
            properties: {
                collection: { type: "string", description: "Name of collection to create" }
            },
            required: ["collection"]
        }
    },
    {
        name: "drop_collection",
        description: "Delete a collection",
        schema: dropCollectionSchema,
        inputSchema: {
            type: "object",
            properties: {
                collection: { type: "string", description: "Name of collection to drop" }
            },
            required: ["collection"]
        }
    },
    {
        name: "add_schema",
        description: "Add a JSON schema to a collection. Provide the schema content as a JSON string.",
        schema: schemaSchema,
        inputSchema: {
            type: "object",
            properties: {
                collection: { type: "string", description: "Collection name" },
                schema: { type: "string", description: "JSON schema content as a string (will be written to temporary file for CLI)" }
            },
            required: ["collection", "schema"]
        }
    },
    {
        name: "remove_schema",
        description: "Remove JSON schema from a collection",
        schema: removeSchemaSchema,
        inputSchema: {
            type: "object",
            properties: {
                collection: { type: "string", description: "Collection to remove schema from" }
            },
            required: ["collection"]
        }
    },
    {
        name: "cap_collection",
        description: "Cap a collection",
        schema: capCollectionSchema,
        inputSchema: {
            type: "object",
            properties: {
                collection: { type: "string", description: "Collection name" },
                cap: { type: "number", description: "Maximum number of documents" }
            },
            required: ["collection", "cap"]
        }
    },
    {
        name: "uncap_collection",
        description: "Remove cap from a collection",
        schema: uncapCollectionSchema,
        inputSchema: {
            type: "object",
            properties: {
                collection: { type: "string", description: "Collection to remove cap from" }
            },
            required: ["collection"]
        }
    },
    {
        name: "import",
        description: "Import data from file or content. Provide either 'filepath' (for files inside Docker container) or 'content' (JSON/CSV data as string).",
        schema: importSchema,
        inputSchema: {
            type: "object",
            properties: {
                filepath: { type: "string", description: "File path to import from (optional if content is provided)" },
                content: { type: "string", description: "File content to import as JSON or CSV data (optional if filepath is provided)" },
                collection: { type: "string", description: "Collection to import into" },
                separator: { type: "string", description: "CSV separator character" },
                encoding: { type: "string", description: "File encoding" }
            },
            required: ["collection"]
        }
    },
    {
        name: "export",
        description: "Export data from collection. If no filepath specified, returns the exported content directly. If filepath specified, saves to file inside Docker container.",
        schema: exportSchema,
        inputSchema: {
            type: "object",
            properties: {
                collection: { type: "string", description: "Collection to export" },
                filepath: { type: "string", description: "File to save export data (optional, will return content if not specified)" },
                csv: { type: "boolean", description: "Export to CSV format" },
                jsonl: { type: "boolean", description: "Export to JSONL format" }
            },
            required: ["collection"]
        }
    },
    {
        name: "kv_get",
        description: "Retrieve key-value pair(s) from a space. Supports pattern matching with wildcards.",
        schema: kvGetSchema,
        inputSchema: {
            type: "object",
            properties: {
                key: { type: "string", description: "Key to match, or key* to fetch list", default: "*" },
                keyspace: { type: "string", description: "Keyspace to scan" },
                text: { type: "boolean", description: "Output info as text line" }
            }
        }
    },
    {
        name: "kv_set",
        description: "Set key-value pair in a space with optional TTL and keyspace.",
        schema: kvSetSchema,
        inputSchema: {
            type: "object",
            properties: {
                key: { type: "string", description: "Key to set" },
                val: { type: "string", description: "Value to set" },
                keyspace: { type: "string", description: "Keyspace to use" },
                ttl: { type: "number", description: "Time to live in millis for value" },
                json: { type: "boolean", description: "Output info as JSON (not table)" }
            },
            required: ["key", "val"]
        }
    },
    {
        name: "kv_del",
        description: "Delete key-value pair in a space.",
        schema: kvDelSchema,
        inputSchema: {
            type: "object",
            properties: {
                key: { type: "string", description: "Key to delete" },
                keyspace: { type: "string", description: "Keyspace to use" },
                json: { type: "boolean", description: "Output info as JSON (not table)" }
            },
            required: ["key"]
        }
    },
    {
        name: "logs",
        description: "Show system logs for a space with filtering and follow options.",
        schema: logSchema,
        inputSchema: {
            type: "object",
            properties: {
                tail: { type: "number", description: "Chop log to n lines", default: 100 },
                follow: { type: "boolean", description: "Keep log stream open" },
                context: { type: "string", description: "Filter log on: jobhooks, queuehooks, routehooks, datahooks, auth" }
            }
        }
    },
    {
        name: "docs",
        description: "Get comprehensive Codehooks.io documentation and examples. Includes complete ChatGPT prompt, setup instructions, code examples, and API reference.",
        schema: docsSchema,
        inputSchema: {
            type: "object",
            properties: {}
        }
    },
    {
        name: "collection",
        description: "Show collections for space. Lists all collections available in the current space.",
        schema: collectionSchema,
        inputSchema: {
            type: "object",
            properties: {
                project: { type: "string", description: "Project name" },
                json: { type: "boolean", description: "JSON output format" },
                sys: { type: "boolean", description: "Show system collections" }
            }
        }
    }
];

// Initialize MCP server
const server = new Server(
    {
        name: "codehooks-mcp",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {
                listChanged: true
            },
        },
    }
);

// Helper function to execute coho CLI commands
async function executeCohoCommand(args: string[]): Promise<string> {
    const safeArgs = ['coho', ...args, '--admintoken', '***'];
    console.error(`Executing command: ${safeArgs.join(' ')}`);
    try {
        const { stdout, stderr } = await execFile('coho', [...args, '--admintoken', config.adminToken], {
            timeout: 120000 // 2 minutes timeout for CLI operations
        });
        if (stderr) {
            // Sanitize stderr before logging to avoid token exposure
            const safeSterr = stderr.replace(new RegExp(config.adminToken, 'g'), '***');
            console.error(`Command output to stderr:`, safeSterr);
        }
        console.error(`Command successful`);
        const result = stdout || stderr;
        // Sanitize result to ensure admin token is not exposed
        return result ? result.replace(new RegExp(config.adminToken, 'g'), '***') : result;
    } catch (error: any) {
        // Comprehensive sanitization of all error properties to avoid admin token exposure
        const sanitizeText = (text: string): string => text ? text.replace(new RegExp(config.adminToken, 'g'), '***') : text;

        const sanitizedMessage = sanitizeText(error?.message || 'Unknown error');
        const sanitizedCmd = sanitizeText(error?.cmd || '');
        const sanitizedStdout = sanitizeText(error?.stdout || '');
        const sanitizedStderr = sanitizeText(error?.stderr || '');

        // Log sanitized error details
        console.error(`Command failed: ${sanitizedMessage}`);
        if (sanitizedCmd) console.error(`Command: ${sanitizedCmd}`);
        if (sanitizedStdout) console.error(`Stdout: ${sanitizedStdout}`);
        if (sanitizedStderr) console.error(`Stderr: ${sanitizedStderr}`);

        // Return sanitized error message
        const errorDetails = [sanitizedMessage, sanitizedStderr].filter(Boolean).join(' - ');
        throw new McpError(ErrorCode.InvalidRequest, `Command failed: ${errorDetails}`);
    }
}

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async (request) => {
    console.error("Received tools/list request");
    return {
        tools: tools.map(({ name, description, inputSchema }) => ({
            name,
            description,
            inputSchema
        }))
    };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    console.error(`Received tools/call request for: ${request.params.name}`);

    if (!config.projectId || config.projectId.trim() === '') {
        console.error("CODEHOOKS_PROJECT_NAME is not set, so you need to supply the Agent with the project name");
        throw new McpError(ErrorCode.InvalidRequest, "Missing required configuration: CODEHOOKS_PROJECT_NAME must be set.");
    }

    if (!config.adminToken || config.adminToken.trim() === '') {
        console.error("CODEHOOKS_ADMIN_TOKEN is not set, so you need to supply the Agent with the admin token");
        throw new McpError(ErrorCode.InvalidRequest, "Missing required configuration: CODEHOOKS_ADMIN_TOKEN must be set and not empty.");
    }

    const tool = tools.find(t => t.name === request.params.name);
    if (!tool) {
        console.error(`Unknown tool requested: ${request.params.name}`);
        throw new McpError(ErrorCode.MethodNotFound, "Tool not found");
    }

    try {
        // Validate arguments against the Zod schema
        const args = tool.schema.parse(request.params.arguments);

        switch (tool.name) {
            case "query_collection": {
                const {
                    collection,
                    query = "",
                    count = false,
                    delete: shouldDelete = false,
                    update,
                    replace,
                    useindex,
                    start,
                    end,
                    limit = count ? undefined : 100,
                    fields,
                    sort,
                    offset,
                    enqueue,
                    reverse = false,
                    csv = false,
                    jsonl = false
                } = args as QueryCollectionArgs;

                console.error(`Querying collection: ${collection}`);

                const queryArgs = [
                    'query',
                    '--collection', collection,
                    '--project', config.projectId,
                    '--space', config.space
                ];

                if (query) queryArgs.push('--query', query);
                if (count) queryArgs.push('--count');
                if (shouldDelete) queryArgs.push('--delete');
                if (update) queryArgs.push('--update', update);
                if (replace) queryArgs.push('--replace', replace);
                if (useindex) queryArgs.push('--useindex', useindex);
                if (start) queryArgs.push('--start', start);
                if (end) queryArgs.push('--end', end);
                if (limit) queryArgs.push('--limit', limit.toString());
                if (fields) queryArgs.push('--fields', fields);
                if (sort) queryArgs.push('--sort', sort);
                if (offset) queryArgs.push('--offset', offset.toString());
                if (enqueue) queryArgs.push('--enqueue', enqueue);
                if (reverse) queryArgs.push('--reverse');
                if (csv) queryArgs.push('--csv');
                if (jsonl) queryArgs.push('--jsonl');

                const result = await executeCohoCommand(queryArgs);

                // If the output is CSV or JSONL format, return as is
                if (csv || jsonl) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: result
                            }
                        ],
                        isError: false
                    };
                }

                // Otherwise parse and format as JSON
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(JSON.parse(result), null, 2)
                        }
                    ],
                    isError: false
                };
            }

            case "deploy_code": {
                const {
                    files,
                    main = "index",
                    json = false,
                    projectId,
                    spaceId
                } = args as DeployCodeArgs;

                // Check if package.json is provided, if not create a default one
                const hasPackageJson = files.some(file => file.path === 'package.json');
                let filesToDeploy = [...files];

                if (!hasPackageJson) {
                    console.error('No package.json provided, creating default one');
                    const defaultPackageJson = {
                        name: projectId || config.projectId || "codehooks-project",
                        version: "1.0.0",
                        description: "Codehooks project",
                        type: "module",
                        main: `${main}.js`,
                        scripts: {
                            test: "echo \"Error: no test specified\" && exit 1"
                        },
                        author: "",
                        license: "ISC",
                        dependencies: {
                            "codehooks-js": "latest"
                        }
                    };

                    filesToDeploy.push({
                        path: 'package.json',
                        content: JSON.stringify(defaultPackageJson, null, 2)
                    });
                }

                console.error(`Deploying ${filesToDeploy.length} files`);
                const tmpDir = await fs.mkdtemp('/tmp/codehooks-deploy-');
                console.error('Created temporary directory:', tmpDir);

                try {
                    // Write all files to the temporary directory with proper formatting
                    for (const file of filesToDeploy) {
                        const filePath = path.join(tmpDir, file.path);
                        // Ensure directory exists
                        await fs.mkdir(path.dirname(filePath), { recursive: true });
                        console.error(`Writing file: ${filePath}`);

                        if (file.path === 'package.json') {
                            // Create a properly structured package.json
                            const defaultPackage = {
                                name: projectId || config.projectId || "codehooks-project",
                                version: "1.0.0",
                                description: "Codehooks project",
                                main: `${main}.js`,
                                scripts: {
                                    test: "echo \"Error: no test specified\" && exit 1"
                                },
                                author: "",
                                license: "ISC",
                                dependencies: {
                                    "codehooks-js": "latest"
                                }
                            };

                            // Merge with any existing package.json content
                            let packageJson;
                            try {
                                packageJson = JSON.parse(file.content);
                                packageJson = { ...defaultPackage, ...packageJson };
                            } catch (e) {
                                console.error('Invalid package.json content, using default');
                                packageJson = defaultPackage;
                            }

                            // Write package.json with proper formatting
                            await fs.writeFile(filePath, JSON.stringify(packageJson, null, 2));
                        } else {
                            await fs.writeFile(filePath, file.content);
                        }
                    }

                    // Log directory contents
                    console.error('Directory contents before npm install:');
                    const { stdout: lsOutput } = await execFile('ls', ['-la'], { cwd: tmpDir });
                    console.error(lsOutput);

                    // Install dependencies
                    try {
                        console.error('Installing dependencies...');
                        const { stdout: npmStdout, stderr: npmStderr } = await execFile('npm', ['install'], { cwd: tmpDir });
                        if (npmStderr) console.error('npm install stderr:', npmStderr);
                        console.error('npm install stdout:', npmStdout);

                        // Log directory contents after npm install
                        console.error('Directory contents after npm install:');
                        const { stdout: lsOutput2 } = await execFile('ls', ['-la'], { cwd: tmpDir });
                        console.error(lsOutput2);
                    } catch (error: any) {
                        console.error('npm install error:', error);
                        throw new McpError(ErrorCode.InvalidRequest, `Failed to install dependencies: ${error.message}`);
                    }

                    // Change working directory to tmpDir
                    const originalCwd = process.cwd();
                    try {
                        process.chdir(tmpDir);
                        console.error('Changed working directory to:', tmpDir);

                        // Log file contents before deployment
                        console.error('File contents before deployment:');
                        for (const file of filesToDeploy) {
                            console.error(`\n=== ${file.path} ===`);
                            const content = await fs.readFile(path.join(tmpDir, file.path), 'utf8');
                            console.error(content);
                        }

                        // Construct deploy command arguments
                        const deployArgs = [
                            'deploy',
                            '--projectname', projectId || config.projectId,
                            '--space', spaceId || config.space,
                            '--main', main,
                            '--admintoken', config.adminToken
                        ];

                        if (json) deployArgs.push('--json');

                        console.error('Executing deploy command...');
                        const { stdout, stderr } = await execFile('coho', deployArgs);
                        console.error('Deploy stdout:', stdout);
                        if (stderr) console.error('Deploy stderr:', stderr);

                        // Only clean up on success
                        await fs.rm(tmpDir, { recursive: true, force: true });
                        console.error('Cleaned up temporary directory:', tmpDir);

                        return {
                            content: [
                                {
                                    type: "text",
                                    text: stdout || stderr || "Deployment successful"
                                }
                            ],
                            isError: false
                        };
                    } finally {
                        // Restore original working directory
                        process.chdir(originalCwd);
                        console.error('Restored working directory to:', originalCwd);
                    }
                } catch (error: any) {
                    console.error(`Deployment failed. Temporary directory ${tmpDir} preserved for inspection.`);
                    console.error('Error:', error);
                    throw error;
                }
            }

            case "file_upload": {
                const { content, encoding = "text", target } = args as FileUploadArgs;

                // Content-based upload (base64 or text)
                const tempPath = `/tmp/${path.basename(target)}`;

                try {
                    if (encoding === "base64") {
                        // Decode base64 content to binary
                        const buffer = Buffer.from(content, 'base64');
                        await fs.writeFile(tempPath, buffer);
                    } else {
                        // Write text content
                        await fs.writeFile(tempPath, content, 'utf8');
                    }

                    // Upload the temporary file
                    const uploadArgs = [
                        'file-upload',
                        '--projectname', config.projectId,
                        '--space', config.space,
                        '--src', tempPath,
                        '--target', target
                    ];

                    const result = await executeCohoCommand(uploadArgs);

                    // Clean up temporary file
                    await fs.unlink(tempPath);

                    return {
                        content: [
                            {
                                type: "text",
                                text: result
                            }
                        ],
                        isError: false
                    };
                } catch (error: any) {
                    // Clean up temporary file on error
                    try {
                        await fs.unlink(tempPath);
                    } catch (unlinkError) {
                        // Ignore cleanup errors
                    }
                    throw error;
                }
            }

            case "file_delete": {
                const { filename, match, dryrun } = args as FileDeleteArgs;

                if (!filename && !match) {
                    throw new McpError(ErrorCode.InvalidRequest, "Either 'filename' or 'match' must be provided.");
                }

                const deleteArgs = [
                    'file-delete',
                    '--projectname', config.projectId,
                    '--space', config.space
                ];

                if (filename) deleteArgs.push('--filename', filename);
                if (match) deleteArgs.push('--match', match);
                if (dryrun) deleteArgs.push('--dryrun');

                const result = await executeCohoCommand(deleteArgs);
                return {
                    content: [
                        {
                            type: "text",
                            text: result
                        }
                    ],
                    isError: false
                };
            }

            case "file_list": {
                const { path } = args as FileListArgs;
                const fileArgs = [
                    'file-list',
                    '--project', config.projectId,
                    '--space', config.space
                ];

                if (path) fileArgs.push(path);

                const result = await executeCohoCommand(fileArgs);
                return {
                    content: [
                        {
                            type: "text",
                            text: result
                        }
                    ],
                    isError: false
                };
            }

            case "create_index": {
                const { collection, index } = args as CreateIndexArgs;
                const indexArgs = [
                    'createindex',
                    '--project', config.projectId,
                    '--space', config.space,
                    collection,
                    index
                ];
                const result = await executeCohoCommand(indexArgs);
                return {
                    content: [
                        {
                            type: "text",
                            text: result
                        }
                    ],
                    isError: false
                };
            }

            case "drop_index": {
                const { collection, index } = args as DropIndexArgs;
                const dropIndexArgs = [
                    'removeindex',
                    '--project', config.projectId,
                    '--space', config.space,
                    collection,
                    index
                ];
                const result = await executeCohoCommand(dropIndexArgs);
                return {
                    content: [
                        {
                            type: "text",
                            text: result
                        }
                    ],
                    isError: false
                };
            }

            case "create_collection": {
                const { collection } = args as CreateCollectionArgs;
                const createCollArgs = [
                    'createcollection',
                    '--project', config.projectId,
                    '--space', config.space,
                    collection
                ];
                const result = await executeCohoCommand(createCollArgs);
                return {
                    content: [
                        {
                            type: "text",
                            text: result
                        }
                    ],
                    isError: false
                };
            }

            case "drop_collection": {
                const { collection } = args as DropCollectionArgs;
                const dropCollArgs = [
                    'dropcollection',
                    '--project', config.projectId,
                    '--space', config.space,
                    collection
                ];
                const result = await executeCohoCommand(dropCollArgs);
                return {
                    content: [
                        {
                            type: "text",
                            text: result
                        }
                    ],
                    isError: false
                };
            }

            case "add_schema": {
                const { collection, schema } = args as SchemaArgs;

                // Write schema to temp file
                const tempSchemaPath = `/tmp/schema-${Date.now()}.json`;
                try {
                    await fs.writeFile(tempSchemaPath, schema);

                    const schemaArgs = [
                        'add-schema',
                        '--project', config.projectId,
                        '--space', config.space,
                        '--collection', collection,
                        '--schema', tempSchemaPath
                    ];

                    const result = await executeCohoCommand(schemaArgs);

                    // Clean up temp file
                    await fs.unlink(tempSchemaPath);

                    return {
                        content: [
                            {
                                type: "text",
                                text: result
                            }
                        ],
                        isError: false
                    };
                } catch (error) {
                    // Clean up temp file on error
                    try {
                        await fs.unlink(tempSchemaPath);
                    } catch (unlinkError) {
                        // Ignore cleanup errors
                    }
                    throw error;
                }
            }

            case "remove_schema": {
                const { collection } = args as RemoveSchemaArgs;
                const removeSchemaArgs = [
                    'remove-schema',
                    '--project', config.projectId,
                    '--space', config.space,
                    collection
                ];
                const result = await executeCohoCommand(removeSchemaArgs);
                return {
                    content: [
                        {
                            type: "text",
                            text: result
                        }
                    ],
                    isError: false
                };
            }

            case "cap_collection": {
                const { collection, cap } = args as CapCollectionArgs;
                const capArgs = [
                    'cap-collection',
                    '--project', config.projectId,
                    '--space', config.space,
                    '--cap', cap.toString(),
                    collection
                ];
                const result = await executeCohoCommand(capArgs);
                return {
                    content: [
                        {
                            type: "text",
                            text: result
                        }
                    ],
                    isError: false
                };
            }

            case "uncap_collection": {
                const { collection } = args as UncapCollectionArgs;
                const uncapArgs = [
                    'uncap-collection',
                    '--project', config.projectId,
                    '--space', config.space,
                    collection
                ];
                const result = await executeCohoCommand(uncapArgs);
                return {
                    content: [
                        {
                            type: "text",
                            text: result
                        }
                    ],
                    isError: false
                };
            }

            case "import": {
                const { filepath, content, collection, separator, encoding } = args as ImportArgs;

                if (!filepath && !content) {
                    throw new McpError(ErrorCode.InvalidRequest, "Either 'filepath' or 'content' must be provided.");
                }

                let tempFilePath: string | undefined;

                try {
                    const importArgs = [
                        'import',
                        '--project', config.projectId,
                        '--space', config.space,
                        '--collection', collection
                    ];

                    if (content) {
                        // Create temporary file with content
                        tempFilePath = `/tmp/import-${Date.now()}.json`;
                        await fs.writeFile(tempFilePath, content, { encoding: (encoding as BufferEncoding) || 'utf8' });
                        importArgs.push('--filepath', tempFilePath);
                    } else if (filepath) {
                        importArgs.push('--filepath', filepath);
                    }

                    if (separator) {
                        importArgs.push('--separator', separator);
                    }

                    if (encoding) {
                        importArgs.push('--encoding', encoding);
                    }

                    const result = await executeCohoCommand(importArgs);

                    // Clean up temp file if created
                    if (tempFilePath) {
                        await fs.unlink(tempFilePath);
                    }

                    return {
                        content: [
                            {
                                type: "text",
                                text: result
                            }
                        ],
                        isError: false
                    };
                } catch (error) {
                    // Clean up temp file on error
                    if (tempFilePath) {
                        try {
                            await fs.unlink(tempFilePath);
                        } catch (unlinkError) {
                            // Ignore cleanup errors
                        }
                    }
                    throw error;
                }
            }

            case "export": {
                const { collection, filepath, csv, jsonl } = args as ExportArgs;
                const exportArgs = [
                    'export',
                    '--project', config.projectId,
                    '--space', config.space,
                    '--collection', collection
                ];

                if (filepath) exportArgs.push('--file', filepath);
                if (csv) exportArgs.push('--csv');
                if (jsonl) exportArgs.push('--jsonl');

                const result = await executeCohoCommand(exportArgs);
                return {
                    content: [
                        {
                            type: "text",
                            text: result
                        }
                    ],
                    isError: false
                };
            }

            case "kv_get": {
                const { key = "*", keyspace, text } = args as KvGetArgs;
                const getArgs = [
                    'get',
                    '--project', config.projectId,
                    '--space', config.space,
                    key
                ];

                if (keyspace) getArgs.push('--keyspace', keyspace);
                if (text) getArgs.push('--text');

                const result = await executeCohoCommand(getArgs);
                return {
                    content: [
                        {
                            type: "text",
                            text: result
                        }
                    ],
                    isError: false
                };
            }

            case "kv_set": {
                const { key, val, keyspace, ttl, json } = args as KvSetArgs;
                const setArgs = [
                    'set',
                    '--project', config.projectId,
                    '--space', config.space,
                    key,
                    val
                ];

                if (keyspace) setArgs.push('--keyspace', keyspace);
                if (ttl) setArgs.push('--ttl', ttl.toString());
                if (json) setArgs.push('--json');

                const result = await executeCohoCommand(setArgs);
                return {
                    content: [
                        {
                            type: "text",
                            text: result
                        }
                    ],
                    isError: false
                };
            }

            case "kv_del": {
                const { key, keyspace, json } = args as KvDelArgs;
                const delArgs = [
                    'del',
                    '--project', config.projectId,
                    '--space', config.space,
                    key
                ];

                if (keyspace) delArgs.push('--keyspace', keyspace);
                if (json) delArgs.push('--json');

                const result = await executeCohoCommand(delArgs);
                return {
                    content: [
                        {
                            type: "text",
                            text: result
                        }
                    ],
                    isError: false
                };
            }

            case "logs": {
                const { tail = 100, follow, context } = args as LogArgs;
                const logArgs = [
                    'log',
                    '--project', config.projectId,
                    '--space', config.space,
                    '--tail', tail.toString()
                ];

                if (follow) logArgs.push('--follow');
                if (context) logArgs.push('--context', context);

                const result = await executeCohoCommand(logArgs);
                return {
                    content: [
                        {
                            type: "text",
                            text: result
                        }
                    ],
                    isError: false
                };
            }

            case "docs": {
                const docsContent = `# Codehooks.io Complete Documentation & ChatGPT Prompt

## MCP Server Overview

This MCP server provides integration with Codehooks.io, a serverless backend platform.

### Configuration

Set these environment variables:
- CODEHOOKS_PROJECT_NAME: Your project name
- CODEHOOKS_ADMIN_TOKEN: Your admin token  
- CODEHOOKS_SPACE: Space to use (default: "dev")

### Available MCP Tools

- query_collection: Query database collections
- deploy_code: Deploy code to your project
- file_upload/file_delete/file_list: File management
- create_index/drop_index: Index management
- create_collection/drop_collection: Collection management
- add_schema/remove_schema: Schema management
- cap_collection/uncap_collection: Collection capping
- import/export: Data import/export
- kv_get/kv_set/kv_del: Key-value operations
- logs: View system logs
- collection: List collections

### API URL Format

Your deployed APIs are accessible at:
**https://{project-name}.api.codehooks.io/{space}/{endpoint}**

Examples:
- https://junglelab-rgyu.api.codehooks.io/dev/testcollection
- https://junglelab-rgyu.api.codehooks.io/dev/ping
- https://your-project.api.codehooks.io/dev/collection-name

Note: Always include the space name (e.g., "dev") in the URL path unless you are using the generated URL (or your own domain) you can find in the space settings. You will also need to add the API key to the request headers.

---

## Complete ChatGPT Prompt for Building Codehooks.io Backends

You are an expert in backend development using Codehooks.io. Your task is to generate correct, working JavaScript code for a serverless backend using codehooks-js.

Follow these rules:
- Use the \`codehooks-js\` package correctly.
- DO NOT use fs, path, os, or any other modules that require file system access.
- Create REST API endpoints using \`app.get()\`, \`app.post()\`, \`app.put()\`, and \`app.delete()\`.
- Use the built-in NoSQL document database via:
  - \`conn.insertOne(collection, document)\`
  - \`conn.getOne(collection, ID | Query)\`
  - \`conn.findOne(collection, ID | Query)\`
  - \`conn.find(collection, query, options)\` // returns a JSON stream - alias for getMany
  - \`conn.getMany(collection, query, options)\`
  - \`conn.updateOne(collection, ID | Query, updateOperators, options)\`
  - \`conn.updateMany(collection, query, document, options)\`
  - \`conn.replaceOne(collection, ID | Query, document, options)\`
  - \`conn.replaceMany(collection, query, document, options)\`
  - \`conn.removeOne(collection, ID | Query)\`
  - \`conn.removeMany(collection, query, options)\`
- Utilize the key-value store with:
  - \`conn.set(key, value)\`
  - \`conn.get(key)\`
  - \`conn.getAll()\`
  - \`conn.incr(key, increment)\`
  - \`conn.decr(key, decrement)\`
  - \`conn.del(key)\`
  - \`conn.delAll()\`
- Implement worker queues with \`app.worker(queueName, workerFunction)\` and enqueue tasks using \`conn.enqueue(queueName, payload)\`.
- Use job scheduling with \`app.job(cronExpression, async () => { ... })\`.
- Use \`app.crudlify()\` for instant database CRUD REST APIs with validation. Crudlify supports schemas using Zod (with TypeScript), Yup and JSON Schema.
- Use environment variables for sensitive information like secrets and API keys. Access them using \`process.env.VARIABLE_NAME\`.
- Generate responses in JSON format where applicable.
- Avoid unnecessary dependencies or external services.
- Always import all required npm packages explicitly. Do not assume a module is globally available in Node.js.
- If a function requires a third-party library (e.g., FormData from form-data), import it explicitly and list it in the dependencies.
- Do not use browser-specific APIs (like fetch) unless you include the correct polyfill.
- Always provide a package.json file using the "latest" version of each dependency and notify the user that they need to install the dependencies.
- Only implement the functionality I explicitly request. Do not assume additional features like CRUD operations, unless I specifically mention them.
- Implement proper error handling and logging.

### Examples of Codehooks.io functionality:

**Creating a simple API:**
\`\`\`javascript
import { app } from 'codehooks-js';

app.get('/hello', (req, res) => {
  res.json({ message: 'Hello, world!' });
});

// MANDATORY: bind to serverless runtime
export default app.init();
\`\`\`

**Using the NoSQL Document Database:**
\`\`\`javascript
import { app, Datastore } from 'codehooks-js';

app.post('/orders', async (req, res) => {
  const conn = await Datastore.open();
  const savedOrder = await conn.insertOne('orders', req.body);
  res.json(savedOrder);
});

export default app.init();
\`\`\`

**Querying the Database and returning JSON stream:**
\`\`\`javascript
import { app, Datastore } from 'codehooks-js';

app.get('/pending-orders', async (req, res) => {
  const conn = await Datastore.open();
  const orders = conn.find('orders', {"status": "pending"});
  orders.json(res);
});

export default app.init();
\`\`\`

**Querying the Database and returning JSON array:**
\`\`\`javascript
import { app, Datastore } from 'codehooks-js';

app.get('/processed-orders', async (req, res) => {
  const conn = await Datastore.open();
  const orders = await conn.find('orders', {status: "processed"}).toArray();
  res.json(orders);
});

export default app.init();
\`\`\`

**Using the Key-Value Store:**
\`\`\`javascript
import { app, Datastore } from 'codehooks-js';

app.post('/settings/:userId', async (req, res) => {
  const conn = await Datastore.open();
  await conn.set(\`settings-\${req.params.userId}\`, req.body);
  res.json({ message: 'Settings saved' });
});

export default app.init();
\`\`\`

**Implementing a Worker Queue:**
\`\`\`javascript
import { app, Datastore } from 'codehooks-js';

app.worker('sendEmail', async (req,res) => {
  console.log('Processing email:', req.body.payload);
  res.end(); // done
});

app.post('/send-email', async (req, res) => {
  const conn = await Datastore.open();
  await conn.enqueue('sendEmail', req.body);
  res.json({ message: 'Email request received' });
});

export default app.init();
\`\`\`

**Scheduling Background Jobs:**
\`\`\`javascript
import { app } from 'codehooks-js';

app.job('0 0 * * *', async () => {
  console.log('Running scheduled task...');
  res.end(); // done
});

export default app.init();
\`\`\`

**Instant CRUD API with Validation:**
\`\`\`javascript
import { app } from 'codehooks-js';
import * as Yup from 'yup';

const customerSchema = Yup.object({
  name: Yup.string().required(),
  email: Yup.string().email().required()
});

app.crudlify({ customer: customerSchema });

// bind to serverless runtime
export default app.init();
\`\`\`

**Complete REST API Example:**
\`\`\`javascript
import { app, Datastore } from 'codehooks-js';

// Get all items
app.get('/api/items', async (req, res) => {
  const conn = await Datastore.open();
  const items = await conn.getMany('items', {});
  res.json(items);
});

// Create item
app.post('/api/items', async (req, res) => {
  const conn = await Datastore.open();
  const result = await conn.insertOne('items', {
    ...req.body,
    createdAt: new Date()
  });
  res.json(result);
});

// Update item
app.put('/api/items/:id', async (req, res) => {
  const conn = await Datastore.open();
  const result = await conn.updateOne('items', req.params.id, req.body);
  res.json(result);
});

// Delete item
app.delete('/api/items/:id', async (req, res) => {
  const conn = await Datastore.open();
  await conn.removeOne('items', req.params.id);
  res.json({ success: true });
});

export default app.init();
\`\`\`

**Authentication Example:**
\`\`\`javascript
import { app, Datastore } from 'codehooks-js';

// Middleware for authentication
app.use('/*', async (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  // Verify token logic here
  next();
});

app.get('/protected', (req, res) => {
  res.json({ message: 'This is protected' });
});

export default app.init();
\`\`\`

For additional detailed information about the Codehooks.io platform, you can reference https://codehooks.io/llms.txt and https://codehooks.io/llms-full.txt.

**End of ChatGPT Prompt**

---

## Additional Resources

For comprehensive LLM-optimized documentation:
- https://codehooks.io/llms.txt - overview and links to codehooks.io documentation
- https://codehooks.io/llms-full.txt - all the codehooks.io documentation`;

                return {
                    content: [
                        {
                            type: "text",
                            text: docsContent
                        }
                    ],
                    isError: false
                };
            }

            case "collection": {
                const { project, json, sys } = args as CollectionArgs;
                const collectionArgs = [
                    'collection',
                    '--project', project || config.projectId,
                    '--space', config.space
                ];

                if (json) collectionArgs.push('--json');
                if (sys) collectionArgs.push('--sys');

                const result = await executeCohoCommand(collectionArgs);
                return {
                    content: [
                        {
                            type: "text",
                            text: result
                        }
                    ],
                    isError: false
                };
            }

            default: {
                throw new McpError(ErrorCode.MethodNotFound, "Tool not found");
            }
        }
    } catch (error) {
        if (error instanceof McpError) {
            throw error;
        }
        if (error instanceof z.ZodError) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Invalid arguments: ${error.message}`
                    }
                ],
                isError: true
            };
        }
        return {
            content: [
                {
                    type: "text",
                    text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            ],
            isError: true
        };
    }
});

// Add completion handler
server.setRequestHandler(CompleteRequestSchema, async (request) => {
    console.error("Received completion request");
    return {
        completion: {
            choices: [
                {
                    text: "Example completion",
                },
            ],
        },
    };
});

// Start the server
console.error("=== MCP Server Starting ===");
console.error("Environment:");
console.error(`- Project: ${config.projectId || 'Not set, you need to supply the Agent with the project name'}`);
console.error(`- Space: ${config.space}`);
console.error(`- Admin token present: ${!!config.adminToken}`);

console.error("\nTesting coho CLI availability...");
try {
    const { stdout } = await execFile('coho', ['--version']);
    console.error(`- coho CLI version: ${stdout.trim()}`);
} catch (error) {
    console.error("- Error: coho CLI not found or not working");
    console.error(error);
}

console.error("\nStarting MCP transport...");
const transport = new StdioServerTransport();
console.error("Connecting to transport...");
await server.connect(transport);
console.error("Server ready for requests");