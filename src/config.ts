/**
 * Configuration module for MCP Mermaid ER Server
 */

import { config as loadEnv } from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// Load environment variables from .env file
loadEnv();

export interface Config {
    /** Path to a Mermaid ER diagram file */
    diagramPath?: string;
    /** URL to fetch Mermaid ER diagram from */
    diagramUrl?: string;
    /** Log level */
    logLevel: 'debug' | 'info' | 'warn' | 'error';

    // Database configuration
    /** Database host */
    dbHost?: string;
    /** Database port */
    dbPort: number;
    /** Database name */
    dbName?: string;
    /** Database user */
    dbUser?: string;
    /** Database password */
    dbPassword?: string;

    // API configuration
    /** API type: rest, graphql, or both */
    apiType: 'rest' | 'graphql' | 'both';
    /** API server port */
    apiPort: number;
    /** API server host */
    apiHost: string;
}

/**
 * Get the current configuration from environment variables
 */
export function getConfig(): Config {
    return {
        diagramPath: process.env.MERMAID_DIAGRAM_PATH,
        diagramUrl: process.env.MERMAID_DIAGRAM_URL,
        logLevel: (process.env.LOG_LEVEL as Config['logLevel']) || 'info',

        // Database
        dbHost: process.env.DB_HOST,
        dbPort: parseInt(process.env.DB_PORT || '5432', 10),
        dbName: process.env.DB_NAME,
        dbUser: process.env.DB_USER,
        dbPassword: process.env.DB_PASSWORD,

        // API
        apiType: (process.env.API_TYPE as Config['apiType']) || 'rest',
        apiPort: parseInt(process.env.API_PORT || '3000', 10),
        apiHost: process.env.API_HOST || '0.0.0.0',
    };
}

/**
 * Load diagram content from configured sources
 * @returns The Mermaid diagram content, or undefined if no source configured
 */
export async function loadDiagramFromConfig(): Promise<string | undefined> {
    const config = getConfig();

    // Try file path first
    if (config.diagramPath) {
        const fullPath = resolve(config.diagramPath);
        if (existsSync(fullPath)) {
            return readFileSync(fullPath, 'utf-8');
        }
    }

    // Try URL
    if (config.diagramUrl) {
        try {
            const response = await fetch(config.diagramUrl);
            if (response.ok) {
                return await response.text();
            }
        } catch (error) {
            // URL fetch failed, return undefined
        }
    }

    return undefined;
}

/**
 * Simple logger based on log level
 */
export const logger = {
    debug: (...args: unknown[]) => {
        if (getConfig().logLevel === 'debug') {
            console.error('[DEBUG]', ...args);
        }
    },
    info: (...args: unknown[]) => {
        const level = getConfig().logLevel;
        if (level === 'debug' || level === 'info') {
            console.error('[INFO]', ...args);
        }
    },
    warn: (...args: unknown[]) => {
        const level = getConfig().logLevel;
        if (level !== 'error') {
            console.error('[WARN]', ...args);
        }
    },
    error: (...args: unknown[]) => {
        console.error('[ERROR]', ...args);
    },
};
