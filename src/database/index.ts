/**
 * Database Connection Module
 * 
 * Provides PostgreSQL connection pool and query utilities
 */

import { Pool, PoolConfig, QueryResult } from 'pg';
import { getConfig, logger } from '../config.js';

let pool: Pool | null = null;

/**
 * Get database configuration from environment
 */
export function getDbConfig(): PoolConfig {
    const config = getConfig();
    return {
        host: config.dbHost,
        port: config.dbPort,
        database: config.dbName,
        user: config.dbUser,
        password: config.dbPassword,
        max: 20, // Maximum pool size
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
    };
}

/**
 * Get or create the database connection pool
 */
export function getPool(): Pool {
    if (!pool) {
        const config = getDbConfig();
        pool = new Pool(config);

        pool.on('error', (err) => {
            logger.error('Unexpected database pool error:', err);
        });

        logger.info(`Database pool created for ${config.host}:${config.port}/${config.database}`);
    }
    return pool;
}

/**
 * Execute a SQL query
 */
export async function query(
    sql: string,
    params?: any[]
): Promise<QueryResult<any>> {
    const pool = getPool();
    const start = Date.now();

    try {
        const result = await pool.query(sql, params);
        const duration = Date.now() - start;
        logger.debug(`Query executed in ${duration}ms: ${sql.substring(0, 100)}...`);
        return result;
    } catch (error) {
        logger.error('Query failed:', { sql: sql.substring(0, 200), error });
        throw error;
    }
}

/**
 * Execute multiple queries in a transaction
 */
export async function transaction<T>(
    callback: (client: {
        query: (sql: string, params?: any[]) => Promise<QueryResult<any>>;
    }) => Promise<T>
): Promise<T> {
    const pool = getPool();
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const result = await callback({
            query: (sql, params) => client.query(sql, params),
        });
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
        const pool = getPool();
        const result = await pool.query('SELECT NOW() as time');
        return {
            success: true
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Close the database pool
 */
export async function closePool(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
        logger.info('Database pool closed');
    }
}

/**
 * Check if database is configured
 */
export function isDatabaseConfigured(): boolean {
    const config = getConfig();
    return !!(config.dbHost && config.dbName && config.dbUser);
}
