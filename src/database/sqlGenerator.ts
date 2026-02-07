/**
 * SQL Generator
 * 
 * Converts parsed ER diagram schema to PostgreSQL DDL statements
 */

import { DatabaseSchema, Entity, Attribute, Relationship } from '../types/schema.js';

/**
 * Map Mermaid types to PostgreSQL types
 */
const TYPE_MAPPING: Record<string, string> = {
    // Numeric types
    'int': 'INTEGER',
    'integer': 'INTEGER',
    'bigint': 'BIGINT',
    'smallint': 'SMALLINT',
    'serial': 'SERIAL',
    'bigserial': 'BIGSERIAL',
    'decimal': 'DECIMAL(10,2)',
    'numeric': 'NUMERIC',
    'float': 'FLOAT',
    'real': 'REAL',
    'double': 'DOUBLE PRECISION',

    // String types
    'string': 'VARCHAR(255)',
    'varchar': 'VARCHAR(255)',
    'text': 'TEXT',
    'char': 'CHAR(1)',

    // Boolean
    'boolean': 'BOOLEAN',
    'bool': 'BOOLEAN',

    // Date/Time
    'date': 'DATE',
    'time': 'TIME',
    'datetime': 'TIMESTAMP',
    'timestamp': 'TIMESTAMP',
    'timestamptz': 'TIMESTAMPTZ',

    // UUID
    'uuid': 'UUID',

    // JSON
    'json': 'JSON',
    'jsonb': 'JSONB',

    // Binary
    'bytea': 'BYTEA',
    'blob': 'BYTEA',
};

/**
 * Convert Mermaid type to PostgreSQL type
 */
export function mapType(mermaidType: string): string {
    const normalized = mermaidType.toLowerCase().trim();

    // Check for array types
    if (normalized.endsWith('[]')) {
        const baseType = normalized.slice(0, -2);
        const pgType = TYPE_MAPPING[baseType] || 'TEXT';
        return `${pgType}[]`;
    }

    // Check for parameterized types like varchar(100)
    const paramMatch = normalized.match(/^(\w+)\((.+)\)$/);
    if (paramMatch) {
        const [, baseType, params] = paramMatch;
        const pgBaseType = TYPE_MAPPING[baseType];
        if (pgBaseType) {
            // If the base type already has params in mapping, use the provided params
            if (pgBaseType.includes('(')) {
                return `${pgBaseType.split('(')[0]}(${params})`;
            }
            return `${pgBaseType}(${params})`;
        }
    }

    return TYPE_MAPPING[normalized] || 'TEXT';
}

/**
 * Convert entity name to PostgreSQL table name (snake_case, lowercase)
 */
export function toTableName(entityName: string): string {
    return entityName
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/[-\s]+/g, '_')
        .toLowerCase();
}

/**
 * Convert attribute name to PostgreSQL column name (snake_case, lowercase)
 */
export function toColumnName(attributeName: string): string {
    return attributeName
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/[-\s]+/g, '_')
        .toLowerCase();
}

/**
 * Generate CREATE TABLE statement for an entity
 */
export function generateCreateTable(entity: Entity): string {
    const tableName = toTableName(entity.name);
    const columns: string[] = [];
    const constraints: string[] = [];

    // Add columns
    for (const attr of entity.attributes) {
        const colName = toColumnName(attr.name);
        const colType = mapType(attr.type);
        let colDef = `  "${colName}" ${colType}`;

        // Add NOT NULL for primary keys
        if (attr.keys.includes('PK')) {
            colDef += ' NOT NULL';
        }

        columns.push(colDef);
    }

    // Add primary key constraint
    const pkColumns = entity.attributes
        .filter(a => a.keys.includes('PK'))
        .map(a => `"${toColumnName(a.name)}"`);

    if (pkColumns.length > 0) {
        constraints.push(`  PRIMARY KEY (${pkColumns.join(', ')})`);
    }

    // Add unique constraints
    const ukColumns = entity.attributes
        .filter(a => a.keys.includes('UK') && !a.keys.includes('PK'));

    for (const ukCol of ukColumns) {
        constraints.push(`  UNIQUE ("${toColumnName(ukCol.name)}")`);
    }

    const allParts = [...columns, ...constraints];

    return `CREATE TABLE IF NOT EXISTS "${tableName}" (\n${allParts.join(',\n')}\n);`;
}

/**
 * Generate foreign key constraints based on relationships
 */
export function generateForeignKeys(
    schema: DatabaseSchema
): string[] {
    const statements: string[] = [];
    const entityMap = new Map(schema.entities.map(e => [e.name.toLowerCase(), e]));

    for (const entity of schema.entities) {
        const tableName = toTableName(entity.name);

        // Find FK columns
        const fkColumns = entity.attributes.filter(a => a.keys.includes('FK'));

        for (const fkCol of fkColumns) {
            const colName = toColumnName(fkCol.name);

            // Try to infer referenced table from column name
            // Common patterns: customer_id -> customer, category_id -> category
            let refTable: string | null = null;
            let refColumn = 'id';

            if (colName.endsWith('_id')) {
                const possibleTable = colName.slice(0, -3);
                // Check if this table exists
                for (const [entityName, _entity] of entityMap) {
                    if (toTableName(entityName) === possibleTable) {
                        refTable = possibleTable;
                        // Find the PK of the referenced table
                        const refEntity = entityMap.get(entityName);
                        if (refEntity) {
                            const refPk = refEntity.attributes.find(a => a.keys.includes('PK'));
                            if (refPk) {
                                refColumn = toColumnName(refPk.name);
                            }
                        }
                        break;
                    }
                }
            }

            if (refTable) {
                const constraintName = `fk_${tableName}_${colName}`;
                statements.push(
                    `ALTER TABLE "${tableName}" ADD CONSTRAINT "${constraintName}" ` +
                    `FOREIGN KEY ("${colName}") REFERENCES "${refTable}" ("${refColumn}") ON DELETE CASCADE;`
                );
            }
        }
    }

    return statements;
}

/**
 * Generate DROP TABLE statements in correct order (respecting dependencies)
 */
export function generateDropTables(schema: DatabaseSchema): string[] {
    // Drop in reverse order of creation (dependencies last)
    const tables = schema.entities.map(e => toTableName(e.name));
    return tables.map(t => `DROP TABLE IF EXISTS "${t}" CASCADE;`);
}

/**
 * Generate complete DDL for entire schema
 */
export function generateSchemaSQL(schema: DatabaseSchema): {
    createTables: string[];
    foreignKeys: string[];
    dropTables: string[];
    fullScript: string;
} {
    const createTables = schema.entities.map(e => generateCreateTable(e));
    const foreignKeys = generateForeignKeys(schema);
    const dropTables = generateDropTables(schema);

    const fullScript = [
        '-- Generated by MCP Mermaid ER Server',
        '-- Create Tables',
        ...createTables,
        '',
        '-- Foreign Key Constraints',
        ...foreignKeys,
    ].join('\n\n');

    return {
        createTables,
        foreignKeys,
        dropTables,
        fullScript,
    };
}
