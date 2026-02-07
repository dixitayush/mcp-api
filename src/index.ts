#!/usr/bin/env node

/**
 * MCP Server for Mermaid ER Diagrams
 * 
 * This server parses Mermaid Entity-Relationship diagrams, creates database
 * schemas, and provides REST/GraphQL CRUD APIs.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { tools } from './tools/erTools.js';
import { dbTools } from './tools/dbTools.js';
import { logger } from './config.js';

// Server metadata
const SERVER_NAME = 'mcp-mermaid-er-server';
const SERVER_VERSION = '2.0.0';

/**
 * Helper to register a tool
 */
function registerTool(
    server: McpServer,
    name: string,
    tool: { description: string; inputSchema: any; handler: (args: any) => Promise<any> }
) {
    server.tool(
        name,
        tool.description,
        tool.inputSchema.shape,
        async (args: any) => {
            const result = await tool.handler(args);
            return {
                content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
            };
        }
    );
}

/**
 * Main entry point
 */
async function main() {
    logger.info(`Starting ${SERVER_NAME} v${SERVER_VERSION}`);

    // Create the MCP server
    const server = new McpServer({
        name: SERVER_NAME,
        version: SERVER_VERSION,
    });

    // Register ER parsing tools
    registerTool(server, 'parse_er_diagram', tools.parse_er_diagram);
    registerTool(server, 'list_entities', tools.list_entities);
    registerTool(server, 'get_entity_details', tools.get_entity_details);
    registerTool(server, 'get_relationships', tools.get_relationships);
    registerTool(server, 'validate_diagram', tools.validate_diagram);

    // Register database tools
    registerTool(server, 'test_connection', dbTools.test_connection);
    registerTool(server, 'generate_sql', dbTools.generate_sql);
    registerTool(server, 'create_schema', dbTools.create_schema);
    registerTool(server, 'drop_schema', dbTools.drop_schema);
    registerTool(server, 'start_api_server', dbTools.start_api_server);
    registerTool(server, 'stop_api_server', dbTools.stop_api_server);
    registerTool(server, 'get_api_endpoints', dbTools.get_api_endpoints);

    logger.info('Registered 12 MCP tools');

    // Connect to stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info('MCP server connected and ready');
}

// Run the server
main().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
});
