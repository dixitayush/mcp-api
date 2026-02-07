/**
 * Database MCP Tools
 * 
 * Tools for creating database schema and managing API server
 */

import { z } from 'zod';
import { parseERDiagram } from '../parser/index.js';
import { loadDiagramFromConfig, getConfig, logger } from '../config.js';
import {
    query,
    transaction,
    testConnection,
    isDatabaseConfigured,
    closePool
} from '../database/index.js';
import { generateSchemaSQL } from '../database/sqlGenerator.js';
import { startApiServer, stopApiServer, getApiServerInfo } from '../api/index.js';
import { DatabaseSchema } from '../types/schema.js';

// Cache for parsed schema
let cachedSchema: DatabaseSchema | null = null;

/**
 * Get schema from diagram (cached or fresh)
 */
async function getSchema(diagramContent?: string): Promise<DatabaseSchema | null> {
    let content = diagramContent;

    if (!content) {
        content = await loadDiagramFromConfig();
    }

    if (!content) {
        return null;
    }

    const result = parseERDiagram(content);
    if (result.success && result.schema) {
        cachedSchema = result.schema;
        return result.schema;
    }

    return null;
}

/**
 * Database tools for MCP server
 */
export const dbTools = {
    test_connection: {
        description: 'Test the PostgreSQL database connection. Returns success or error message.',
        inputSchema: z.object({}),
        handler: async () => {
            if (!isDatabaseConfigured()) {
                return {
                    success: false,
                    error: 'Database not configured. Set DB_HOST, DB_NAME, DB_USER, DB_PASSWORD in .env',
                };
            }

            const result = await testConnection();
            return result;
        },
    },

    generate_sql: {
        description: 'Generate SQL DDL statements from the ER diagram without executing them. Useful for reviewing the SQL before creating tables.',
        inputSchema: z.object({
            diagram: z.string().optional().describe('Mermaid ER diagram text. Uses configured source if not provided.'),
        }),
        handler: async (args: { diagram?: string }) => {
            const schema = await getSchema(args.diagram);

            if (!schema) {
                return {
                    success: false,
                    error: 'No diagram provided and no diagram source configured.',
                };
            }

            const sql = generateSchemaSQL(schema);

            return {
                success: true,
                createTables: sql.createTables,
                foreignKeys: sql.foreignKeys,
                dropTables: sql.dropTables,
                fullScript: sql.fullScript,
                summary: {
                    tableCount: sql.createTables.length,
                    foreignKeyCount: sql.foreignKeys.length,
                },
            };
        },
    },

    create_schema: {
        description: 'Create PostgreSQL tables from the ER diagram. This will execute DDL statements to create tables and foreign key constraints.',
        inputSchema: z.object({
            diagram: z.string().optional().describe('Mermaid ER diagram text. Uses configured source if not provided.'),
            dropExisting: z.boolean().optional().describe('Drop existing tables before creating. Default: false'),
        }),
        handler: async (args: { diagram?: string; dropExisting?: boolean }) => {
            if (!isDatabaseConfigured()) {
                return {
                    success: false,
                    error: 'Database not configured. Set DB_HOST, DB_NAME, DB_USER, DB_PASSWORD in .env',
                };
            }

            const schema = await getSchema(args.diagram);

            if (!schema) {
                return {
                    success: false,
                    error: 'No diagram provided and no diagram source configured.',
                };
            }

            const sql = generateSchemaSQL(schema);
            const results: string[] = [];
            const errors: string[] = [];

            try {
                await transaction(async (client) => {
                    // Drop existing tables if requested
                    if (args.dropExisting) {
                        for (const dropSql of sql.dropTables) {
                            try {
                                await client.query(dropSql);
                                results.push(`Dropped: ${dropSql.match(/"([^"]+)"/)?.[1] || 'table'}`);
                            } catch (err: any) {
                                // Ignore drop errors (table might not exist)
                            }
                        }
                    }

                    // Create tables
                    for (const createSql of sql.createTables) {
                        try {
                            await client.query(createSql);
                            const tableName = createSql.match(/CREATE TABLE[^"]*"([^"]+)"/i)?.[1];
                            results.push(`Created table: ${tableName}`);
                        } catch (err: any) {
                            errors.push(`Failed to create table: ${err.message}`);
                            throw err;
                        }
                    }

                    // Add foreign keys
                    for (const fkSql of sql.foreignKeys) {
                        try {
                            await client.query(fkSql);
                            const constraintName = fkSql.match(/CONSTRAINT "([^"]+)"/)?.[1];
                            results.push(`Added FK: ${constraintName}`);
                        } catch (err: any) {
                            // FK might fail if referenced table doesn't exist, continue anyway
                            errors.push(`FK warning: ${err.message}`);
                        }
                    }
                });

                return {
                    success: true,
                    message: 'Schema created successfully',
                    results,
                    warnings: errors.length > 0 ? errors : undefined,
                };
            } catch (error: any) {
                return {
                    success: false,
                    error: error.message,
                    results,
                    errors,
                };
            }
        },
    },

    drop_schema: {
        description: 'Drop all tables defined in the ER diagram. WARNING: This will delete all data!',
        inputSchema: z.object({
            diagram: z.string().optional().describe('Mermaid ER diagram text. Uses configured source if not provided.'),
            confirm: z.boolean().describe('Must be true to confirm deletion'),
        }),
        handler: async (args: { diagram?: string; confirm: boolean }) => {
            if (!args.confirm) {
                return {
                    success: false,
                    error: 'Please set confirm: true to drop tables. This action cannot be undone!',
                };
            }

            if (!isDatabaseConfigured()) {
                return {
                    success: false,
                    error: 'Database not configured.',
                };
            }

            const schema = await getSchema(args.diagram);

            if (!schema) {
                return {
                    success: false,
                    error: 'No diagram provided and no diagram source configured.',
                };
            }

            const sql = generateSchemaSQL(schema);
            const dropped: string[] = [];

            for (const dropSql of sql.dropTables) {
                try {
                    await query(dropSql);
                    const tableName = dropSql.match(/"([^"]+)"/)?.[1];
                    if (tableName) dropped.push(tableName);
                } catch (err: any) {
                    // Ignore errors (table might not exist)
                }
            }

            return {
                success: true,
                message: `Dropped ${dropped.length} tables`,
                droppedTables: dropped,
            };
        },
    },

    start_api_server: {
        description: 'Start the REST/GraphQL API server for the entities in the ER diagram.',
        inputSchema: z.object({
            diagram: z.string().optional().describe('Mermaid ER diagram text. Uses configured source if not provided.'),
        }),
        handler: async (args: { diagram?: string }) => {
            const schema = await getSchema(args.diagram);

            if (!schema) {
                return {
                    success: false,
                    error: 'No diagram provided and no diagram source configured.',
                };
            }

            try {
                const info = await startApiServer(schema);
                const config = getConfig();

                return {
                    success: true,
                    message: `API server started at http://${config.apiHost}:${config.apiPort}`,
                    ...info,
                };
            } catch (error: any) {
                return {
                    success: false,
                    error: error.message,
                };
            }
        },
    },

    stop_api_server: {
        description: 'Stop the running API server.',
        inputSchema: z.object({}),
        handler: async () => {
            const result = await stopApiServer();

            if (result.stopped) {
                return {
                    success: true,
                    message: 'API server stopped',
                };
            } else {
                return {
                    success: false,
                    error: 'No API server is currently running',
                };
            }
        },
    },

    get_api_endpoints: {
        description: 'Get information about the running API server and its endpoints.',
        inputSchema: z.object({}),
        handler: async () => {
            const info = getApiServerInfo();

            if (!info.running) {
                return {
                    success: false,
                    error: 'API server is not running. Use start_api_server to start it.',
                };
            }

            return {
                success: true,
                ...info,
            };
        },
    },
};
