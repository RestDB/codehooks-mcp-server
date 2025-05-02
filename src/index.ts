import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ErrorCode,
    ListToolsRequestSchema,
    McpError,
    CompleteRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { promisify } from "util";
import { exec as execCallback } from "child_process";
import { promises as fs } from 'fs';

const exec = promisify(execCallback);

// Configuration and types
interface CodehooksConfig {
    projectId: string;
    space: string;
    adminToken: string;
}

const config: CodehooksConfig = {
    projectId: process.env.CODEHOOKS_PROJECT_ID || "",
    space: process.env.CODEHOOKS_SPACE || "dev",
    adminToken: process.env.CODEHOOKS_ADMIN_TOKEN || "",
};

// Tool schemas with proper typing
const queryCollectionSchema = z.object({
    collection: z.string(),
    query: z.string().optional(),
    limit: z.number().optional(),
});

const deployCodeSchema = z.object({
    filename: z.string(),
    code: z.string(),
});

const viewLogsSchema = z.object({
    limit: z.number().optional(),
});

// Initialize MCP server
const server = new Server(
    {
        name: "codehooks-mcp",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Helper function to execute coho CLI commands
async function executeCohoCommand(command: string): Promise<string> {
    try {
        const { stdout, stderr } = await exec(`coho ${command} --admintoken ${config.adminToken}`);
        if (stderr) {
            throw new Error(stderr);
        }
        return stdout;
    } catch (error: any) {
        throw new McpError(1, `Command failed: ${error?.message || 'Unknown error'}`);
    }
}

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "query_collection",
                description: "Query data from a collection using the Codehooks CLI",
                inputSchema: queryCollectionSchema,
            },
            {
                name: "deploy_code",
                description: "Deploy JavaScript code using the Codehooks CLI",
                inputSchema: deployCodeSchema,
            },
            {
                name: "view_logs",
                description: "View project logs using the Codehooks CLI",
                inputSchema: viewLogsSchema,
            },
            {
                name: "list_collections",
                description: "List available collections using the Codehooks CLI",
                inputSchema: z.object({}),
            },
        ],
    };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (!config.projectId) {
        throw new McpError(1, "Missing required configuration: CODEHOOKS_PROJECT_ID");
    }

    if (!config.adminToken) {
        throw new McpError(1, "Missing required configuration: CODEHOOKS_ADMIN_TOKEN");
    }

    const args = request.params.arguments as Record<string, unknown>;

    switch (request.params.name) {
        case "query_collection": {
            const collection = args.collection as string;
            const query = args.query as string || "";
            const limit = (args.limit as number) || 100;

            const result = await executeCohoCommand(
                `query ${config.projectId} ${collection} '${query}' --limit ${limit} --space ${config.space}`
            );
            return { toolResult: JSON.parse(result) };
        }

        case "deploy_code": {
            const filename = args.filename as string;
            const code = args.code as string;

            // Write code to temporary file
            const tmpFile = `/tmp/${filename}`;
            await fs.writeFile(tmpFile, code);

            const result = await executeCohoCommand(
                `deploy ${config.projectId} --space ${config.space} --file ${tmpFile}`
            );

            // Clean up temporary file
            await fs.unlink(tmpFile);

            return { toolResult: { message: result } };
        }

        case "view_logs": {
            const limit = (args.limit as number) || 100;

            const result = await executeCohoCommand(
                `logs ${config.projectId} --space ${config.space} --limit ${limit}`
            );
            return { toolResult: { logs: result.split('\n') } };
        }

        case "list_collections": {
            const result = await executeCohoCommand(
                `collections ${config.projectId} --space ${config.space}`
            );
            return { toolResult: { collections: result.split('\n').filter(Boolean) } };
        }

        default:
            throw new McpError(2, "Tool not found");
    }
});

// Add completion handler
server.setRequestHandler(CompleteRequestSchema, async (request) => {
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
const transport = new StdioServerTransport();
await server.connect(transport); 