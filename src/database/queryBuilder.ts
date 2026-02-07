/**
 * Query Builder
 * 
 * Generates CRUD SQL queries for entities
 */

import { Entity } from '../types/schema.js';
import { toTableName, toColumnName } from './sqlGenerator.js';

export interface QueryConfig {
    tableName: string;
    columns: string[];
    primaryKey: string;
}

/**
 * Build query config from entity
 */
export function buildQueryConfig(entity: Entity): QueryConfig {
    const tableName = toTableName(entity.name);
    const columns = entity.attributes.map(a => toColumnName(a.name));
    const pkAttr = entity.attributes.find(a => a.keys.includes('PK'));
    const primaryKey = pkAttr ? toColumnName(pkAttr.name) : columns[0];

    return { tableName, columns, primaryKey };
}

/**
 * Generate SELECT ALL query
 */
export function selectAll(config: QueryConfig, options?: {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDir?: 'ASC' | 'DESC';
}): { sql: string; params: any[] } {
    let sql = `SELECT * FROM "${config.tableName}"`;
    const params: any[] = [];

    if (options?.orderBy) {
        sql += ` ORDER BY "${options.orderBy}" ${options.orderDir || 'ASC'}`;
    }

    if (options?.limit) {
        sql += ` LIMIT $${params.length + 1}`;
        params.push(options.limit);
    }

    if (options?.offset) {
        sql += ` OFFSET $${params.length + 1}`;
        params.push(options.offset);
    }

    return { sql, params };
}

/**
 * Generate SELECT by ID query
 */
export function selectById(config: QueryConfig, id: any): { sql: string; params: any[] } {
    return {
        sql: `SELECT * FROM "${config.tableName}" WHERE "${config.primaryKey}" = $1`,
        params: [id],
    };
}

/**
 * Generate INSERT query
 */
export function insert(config: QueryConfig, data: Record<string, any>): { sql: string; params: any[] } {
    const keys = Object.keys(data).filter(k => config.columns.includes(k));
    const values = keys.map(k => data[k]);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    return {
        sql: `INSERT INTO "${config.tableName}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
        params: values,
    };
}

/**
 * Generate UPDATE query
 */
export function update(
    config: QueryConfig,
    id: any,
    data: Record<string, any>
): { sql: string; params: any[] } {
    const keys = Object.keys(data).filter(k =>
        config.columns.includes(k) && k !== config.primaryKey
    );
    const values = keys.map(k => data[k]);
    const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`);

    return {
        sql: `UPDATE "${config.tableName}" SET ${setClauses.join(', ')} WHERE "${config.primaryKey}" = $${keys.length + 1} RETURNING *`,
        params: [...values, id],
    };
}

/**
 * Generate DELETE query
 */
export function deleteById(config: QueryConfig, id: any): { sql: string; params: any[] } {
    return {
        sql: `DELETE FROM "${config.tableName}" WHERE "${config.primaryKey}" = $1 RETURNING *`,
        params: [id],
    };
}

/**
 * Generate COUNT query
 */
export function count(config: QueryConfig): { sql: string; params: any[] } {
    return {
        sql: `SELECT COUNT(*) as count FROM "${config.tableName}"`,
        params: [],
    };
}

/**
 * Build a CRUD helper object for an entity
 */
export function createCrudQueries(entity: Entity) {
    const config = buildQueryConfig(entity);

    return {
        config,
        selectAll: (options?: Parameters<typeof selectAll>[1]) => selectAll(config, options),
        selectById: (id: any) => selectById(config, id),
        insert: (data: Record<string, any>) => insert(config, data),
        update: (id: any, data: Record<string, any>) => update(config, id, data),
        delete: (id: any) => deleteById(config, id),
        count: () => count(config),
    };
}
