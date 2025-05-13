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
    json: z.boolean().optional(),
    projectId: z.string().optional(),
    spaceId: z.string().optional()
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
                json: { type: "boolean", description: "Output JSON format" },
                projectId: { type: "string", description: "Project ID" },
                spaceId: { type: "string", description: "Space ID", default: "dev" }
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
        const { stdout, stderr } = await exec(`coho ${command} --admintoken ${config.adminToken} `);
        if (stderr) {
            console.error(`Command output to stderr:`, stderr);
        }
        console.error(`Command successful`);
        return stdout || stderr; // Return either stdout or stderr as some commands output to stderr
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
        console.error("CODEHOOKS_PROJECT_NAME is not set, so you need to supply the Agent with the project name");
    }

    if (!config.adminToken) {
        console.error("CODEHOOKS_ADMIN_TOKEN is not set, so you need to supply the Agent with the admin token");
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
                    json = false,
                    projectId,
                    spaceId
                } = args as DeployCodeArgs;

                console.error(`Deploying ${files.length} files`);
                const tmpDir = await fs.mkdtemp('/tmp/codehooks-deploy-');
                console.error('Created temporary directory:', tmpDir);

                try {
                    // Write all files to the temporary directory with proper formatting
                    for (const file of files) {
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
                    const { stdout: lsOutput } = await exec('ls -la', { cwd: tmpDir });
                    console.error(lsOutput);

                    // Install dependencies
                    try {
                        console.error('Installing dependencies...');
                        const { stdout: npmStdout, stderr: npmStderr } = await exec('npm install', { cwd: tmpDir });
                        if (npmStderr) console.error('npm install stderr:', npmStderr);
                        console.error('npm install stdout:', npmStdout);

                        // Log directory contents after npm install
                        console.error('Directory contents after npm install:');
                        const { stdout: lsOutput2 } = await exec('ls -la', { cwd: tmpDir });
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
                        for (const file of files) {
                            console.error(`\n=== ${file.path} ===`);
                            const content = await fs.readFile(path.join(tmpDir, file.path), 'utf8');
                            console.error(content);
                        }

                        // Construct command exactly like the working direct command
                        const deployCommand = [
                            'coho deploy',
                            `--projectname ${projectId || config.projectId}`,
                            `--space ${spaceId || config.space}`,
                            `--main ${main}`,
                            `--admintoken ${config.adminToken}`,
                            json ? '--json' : ''
                        ].filter(Boolean).join(' ');

                        console.error('Executing deploy command...');
                        const { stdout, stderr } = await exec(deployCommand);
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
console.error(`- Project: ${config.projectId || 'Not set, you need to supply the Agent with the project name'}`);
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