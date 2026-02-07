/**
 * API Server
 * 
 * Express server with REST and/or GraphQL endpoints
 */

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { DatabaseSchema } from '../types/schema.js';
import { getConfig, logger } from '../config.js';
import { createRestRouter } from './restRouter.js';
import { generateGraphQLSchema, createResolvers } from './graphqlSchema.js';

let server: ReturnType<Express['listen']> | null = null;
let currentEndpoints: Array<{ method: string; path: string; entity: string }> = [];

export interface ApiServerInfo {
    running: boolean;
    port?: number;
    host?: string;
    apiType?: string;
    endpoints?: typeof currentEndpoints;
    graphqlEndpoint?: string;
}

/**
 * Start the API server
 */
export async function startApiServer(schema: DatabaseSchema): Promise<ApiServerInfo> {
    if (server) {
        return getApiServerInfo();
    }

    const config = getConfig();
    const app = express();

    // Middleware
    app.use(cors());
    app.use(express.json());

    // Health check endpoint
    app.get('/health', (_req: Request, res: Response) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Schema info endpoint
    app.get('/schema', (_req: Request, res: Response) => {
        res.json({
            entities: schema.entities.map(e => ({
                name: e.name,
                attributes: e.attributes.map(a => ({
                    name: a.name,
                    type: a.type,
                    keys: a.keys,
                })),
            })),
            relationships: schema.relationships.length,
        });
    });

    currentEndpoints = [];

    // REST API
    if (config.apiType === 'rest' || config.apiType === 'both') {
        const { router, endpoints } = createRestRouter(schema);
        app.use('/api', router);
        currentEndpoints.push(...endpoints);
        logger.info(`REST API enabled with ${endpoints.length} endpoints`);
    }

    // GraphQL API
    if (config.apiType === 'graphql' || config.apiType === 'both') {
        const typeDefs = generateGraphQLSchema(schema);
        const resolvers = createResolvers(schema);

        const apolloServer = new ApolloServer({
            typeDefs,
            resolvers,
        });

        await apolloServer.start();

        // Custom GraphQL handler using executeHTTPGraphQLRequest
        app.post('/graphql', async (req: Request, res: Response) => {
            try {
                const result = await apolloServer.executeOperation({
                    query: req.body.query,
                    variables: req.body.variables,
                    operationName: req.body.operationName,
                });

                if (result.body.kind === 'single') {
                    res.json(result.body.singleResult);
                } else {
                    res.json({ errors: [{ message: 'Streaming not supported' }] });
                }
            } catch (error: any) {
                res.status(500).json({ errors: [{ message: error.message }] });
            }
        });

        // GraphQL playground/explorer
        app.get('/graphql', (_req: Request, res: Response) => {
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>GraphQL Playground</title>
                    <style>body { font-family: sans-serif; padding: 20px; }</style>
                </head>
                <body>
                    <h1>GraphQL API</h1>
                    <p>Send POST requests to /graphql with your GraphQL queries.</p>
                    <p>Schema generated from Mermaid ER diagram.</p>
                </body>
                </html>
            `);
        });

        logger.info('GraphQL API enabled at /graphql');
    }

    // Start server
    return new Promise((resolve, reject) => {
        try {
            server = app.listen(config.apiPort, config.apiHost, () => {
                logger.info(`API server running at http://${config.apiHost}:${config.apiPort}`);
                resolve(getApiServerInfo());
            });

            server.on('error', (err) => {
                logger.error('Server error:', err);
                reject(err);
            });
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Stop the API server
 */
export async function stopApiServer(): Promise<{ stopped: boolean }> {
    if (!server) {
        return { stopped: false };
    }

    return new Promise((resolve) => {
        server!.close(() => {
            logger.info('API server stopped');
            server = null;
            currentEndpoints = [];
            resolve({ stopped: true });
        });
    });
}

/**
 * Get current server info
 */
export function getApiServerInfo(): ApiServerInfo {
    if (!server) {
        return { running: false };
    }

    const config = getConfig();
    return {
        running: true,
        port: config.apiPort,
        host: config.apiHost,
        apiType: config.apiType,
        endpoints: currentEndpoints,
        graphqlEndpoint: (config.apiType === 'graphql' || config.apiType === 'both')
            ? `http://${config.apiHost}:${config.apiPort}/graphql`
            : undefined,
    };
}

/**
 * Check if server is running
 */
export function isApiServerRunning(): boolean {
    return server !== null;
}
