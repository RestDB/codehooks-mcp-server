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
import { exec as execCallback } from "child_process";
import { promises as fs } from 'fs';
import path from 'path';

const exec = promisify(execCallback);

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
    pretty: z.boolean().optional(),
    reverse: z.boolean().optional(),
    table: z.boolean().optional(),
    csv: z.boolean().optional()
});

const deployCodeSchema = z.object({
    files: z.array(z.object({
        path: z.string(),
        content: z.string()
    })),
    main: z.string().optional(),
    json: z.boolean().optional()
});

// Add type inference
type QueryCollectionArgs = z.infer<typeof queryCollectionSchema>;
type DeployCodeArgs = z.infer<typeof deployCodeSchema>;

// Tool definitions with JSON Schema for tools/list
const tools = [
    {
        name: "query_collection",
        description: "Query data from a collection using the Codehooks CLI",
        schema: queryCollectionSchema,
        inputSchema: {
            type: "object",
            properties: {
                collection: { type: "string", description: "Collection name" },
                query: { type: "string", description: "Query expression (e.g. 'name=Polly&type=Parrot' or 'name=/^po/')" },
                count: { type: "boolean", description: "Count query results" },
                delete: { type: "boolean", description: "Delete all items from query result" },
                update: { type: "string", description: "Patch all items from query result with JSON string '{...}'" },
                replace: { type: "string", description: "Replace all items from query result with JSON string '{...}'" },
                useindex: { type: "string", description: "Use an indexed field to scan data in query" },
                start: { type: "string", description: "Start value for index scan" },
                end: { type: "string", description: "End value for index scan" },
                limit: { type: "number", description: "Limit query result" },
                fields: { type: "string", description: "Comma separated list of fields to include" },
                sort: { type: "string", description: "Comma separated list of fields to sort by" },
                offset: { type: "number", description: "Skip items before returning data in query result" },
                enqueue: { type: "string", description: "Add query result to queue topic" },
                pretty: { type: "boolean", description: "Output data with formatting and colors" },
                reverse: { type: "boolean", description: "Scan index in reverse order" },
                table: { type: "boolean", description: "Output data as formatted table" },
                csv: { type: "boolean", description: "Output data in CSV format" }
            },
            required: ["collection"]
        }
    },
    {
        name: "deploy_code",
        description: "Deploy JavaScript code using the Codehooks CLI",
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
                json: { type: "boolean", description: "Output JSON format" }
            },
            required: ["files"]
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
async function executeCohoCommand(command: string): Promise<string> {
    console.error(`Executing command: coho ${command.replace(config.adminToken, '***')}`);
    try {
        const { stdout, stderr } = await exec(`coho ${command} --admintoken ${config.adminToken}`);
        if (stderr) {
            console.error(`Command error: ${stderr}`);
            throw new Error(stderr);
        }
        console.error(`Command successful`);
        return stdout;
    } catch (error: any) {
        console.error(`Command failed: ${error?.message || 'Unknown error'}`);
        throw new McpError(ErrorCode.InvalidRequest, `Command failed: ${error?.message || 'Unknown error'}`);
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

    if (!config.projectId) {
        console.error("Missing CODEHOOKS_PROJECT_NAME configuration");
        throw new McpError(ErrorCode.InvalidRequest, "Missing required configuration: CODEHOOKS_PROJECT_NAME");
    }

    if (!config.adminToken) {
        console.error("Missing CODEHOOKS_ADMIN_TOKEN configuration");
        throw new McpError(ErrorCode.InvalidRequest, "Missing required configuration: CODEHOOKS_ADMIN_TOKEN");
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
                    pretty = false,
                    reverse = false,
                    table = false,
                    csv = false
                } = args as QueryCollectionArgs;

                console.error(`Querying collection: ${collection}`);

                const queryParams = [
                    `--collection ${collection}`,
                    `--project ${config.projectId}`,
                    `--space ${config.space}`,
                    query ? `--query '${query}'` : '',
                    count ? '--count' : '',
                    shouldDelete ? '--delete' : '',
                    update ? `--update '${update}'` : '',
                    replace ? `--replace '${replace}'` : '',
                    useindex ? `--useindex ${useindex}` : '',
                    start ? `--start '${start}'` : '',
                    end ? `--end '${end}'` : '',
                    limit ? `--limit ${limit}` : '',
                    fields ? `--fields '${fields}'` : '',
                    sort ? `--sort '${sort}'` : '',
                    offset ? `--offset ${offset}` : '',
                    enqueue ? `--enqueue ${enqueue}` : '',
                    pretty ? '--pretty' : '',
                    reverse ? '--reverse' : '',
                    table ? '--table' : '',
                    csv ? '--csv' : ''
                ].filter(Boolean).join(' ');

                const result = await executeCohoCommand(`query ${queryParams}`);

                // If the output is CSV or table format, return as is
                if (csv || table || pretty) {
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
                    json = false
                } = args as DeployCodeArgs;

                console.error(`Deploying ${files.length} files`);

                // Create temporary directory
                const tmpDir = await fs.mkdtemp('/tmp/codehooks-deploy-');
                try {
                    // Write all files to the temporary directory
                    for (const file of files) {
                        const filePath = `${tmpDir}/${file.path}`;
                        // Ensure directory exists
                        await fs.mkdir(path.dirname(filePath), { recursive: true });
                        await fs.writeFile(filePath, file.content);
                    }

                    const deployParams = [
                        `--projectname ${config.projectId}`,
                        `--space ${config.space}`,
                        `--dir ${tmpDir}`,
                        `--main ${main}`,
                        json ? '--json' : ''
                    ].filter(Boolean).join(' ');

                    const result = await executeCohoCommand(`deploy ${deployParams}`);
                    return {
                        content: [
                            {
                                type: "text",
                                text: result
                            }
                        ],
                        isError: false
                    };
                } finally {
                    // Clean up temporary directory
                    await fs.rm(tmpDir, { recursive: true, force: true });
                }
            }

            default:
                throw new McpError(ErrorCode.MethodNotFound, "Tool not found");
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
console.error(`- Project: ${config.projectId}`);
console.error(`- Space: ${config.space}`);
console.error(`- Admin token present: ${!!config.adminToken}`);

console.error("\nTesting coho CLI availability...");
try {
    const { stdout } = await exec('coho --version');
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