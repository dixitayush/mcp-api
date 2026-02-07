/**
 * GraphQL Schema Generator
 * 
 * Dynamically generates GraphQL types, queries, and mutations from ER schema
 */

import { DatabaseSchema, Entity } from '../types/schema.js';
import { query } from '../database/index.js';
import { createCrudQueries } from '../database/queryBuilder.js';
import { toTableName, toColumnName, mapType } from '../database/sqlGenerator.js';

/**
 * Map PostgreSQL/Mermaid types to GraphQL types
 */
function toGraphQLType(mermaidType: string): string {
    const lower = mermaidType.toLowerCase();

    if (lower.includes('int') || lower === 'serial' || lower === 'bigserial') {
        return 'Int';
    }
    if (lower.includes('float') || lower.includes('double') || lower.includes('decimal') || lower.includes('numeric') || lower === 'real') {
        return 'Float';
    }
    if (lower.includes('bool')) {
        return 'Boolean';
    }
    if (lower === 'uuid') {
        return 'ID';
    }

    return 'String';
}

/**
 * Convert entity name to GraphQL type name (PascalCase)
 */
function toTypeName(entityName: string): string {
    return entityName
        .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
        .replace(/^./, c => c.toUpperCase());
}

/**
 * Convert entity name to camelCase for queries/mutations
 */
function toCamelCase(entityName: string): string {
    const pascal = toTypeName(entityName);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Generate GraphQL type definition for an entity
 */
function generateTypeDef(entity: Entity): string {
    const typeName = toTypeName(entity.name);
    const fields = entity.attributes.map(attr => {
        const gqlType = toGraphQLType(attr.type);
        const nullable = attr.keys.includes('PK') ? '!' : '';
        return `  ${attr.name}: ${gqlType}${nullable}`;
    });

    return `type ${typeName} {
${fields.join('\n')}
}`;
}

/**
 * Generate input type for create/update
 */
function generateInputType(entity: Entity): string {
    const typeName = toTypeName(entity.name);
    const fields = entity.attributes
        .filter(attr => !attr.keys.includes('PK') || attr.type.toLowerCase() !== 'serial')
        .map(attr => {
            const gqlType = toGraphQLType(attr.type);
            return `  ${attr.name}: ${gqlType}`;
        });

    return `input ${typeName}Input {
${fields.join('\n')}
}`;
}

/**
 * Generate complete GraphQL schema string
 */
export function generateGraphQLSchema(schema: DatabaseSchema): string {
    const typeDefs: string[] = [];
    const queryFields: string[] = [];
    const mutationFields: string[] = [];

    for (const entity of schema.entities) {
        const typeName = toTypeName(entity.name);
        const fieldName = toCamelCase(entity.name);
        const pluralName = fieldName + 's';

        // Type definition
        typeDefs.push(generateTypeDef(entity));
        typeDefs.push(generateInputType(entity));

        // Query fields
        queryFields.push(`  ${pluralName}(limit: Int, offset: Int): [${typeName}!]!`);
        queryFields.push(`  ${fieldName}(id: ID!): ${typeName}`);

        // Mutation fields
        mutationFields.push(`  create${typeName}(input: ${typeName}Input!): ${typeName}!`);
        mutationFields.push(`  update${typeName}(id: ID!, input: ${typeName}Input!): ${typeName}`);
        mutationFields.push(`  delete${typeName}(id: ID!): ${typeName}`);
    }

    return `${typeDefs.join('\n\n')}

type Query {
${queryFields.join('\n')}
}

type Mutation {
${mutationFields.join('\n')}
}`;
}

/**
 * Create resolvers for all entities
 */
export function createResolvers(schema: DatabaseSchema): {
    Query: Record<string, any>;
    Mutation: Record<string, any>;
} {
    const Query: Record<string, any> = {};
    const Mutation: Record<string, any> = {};

    for (const entity of schema.entities) {
        const crud = createCrudQueries(entity);
        const typeName = toTypeName(entity.name);
        const fieldName = toCamelCase(entity.name);
        const pluralName = fieldName + 's';

        // List all
        Query[pluralName] = async (_: any, args: { limit?: number; offset?: number }) => {
            const { sql, params } = crud.selectAll({
                limit: args.limit,
                offset: args.offset,
            });
            const result = await query(sql, params);
            return result.rows;
        };

        // Get by ID
        Query[fieldName] = async (_: any, args: { id: any }) => {
            const { sql, params } = crud.selectById(args.id);
            const result = await query(sql, params);
            return result.rows[0] || null;
        };

        // Create
        Mutation[`create${typeName}`] = async (_: any, args: { input: Record<string, any> }) => {
            const { sql, params } = crud.insert(args.input);
            const result = await query(sql, params);
            return result.rows[0];
        };

        // Update
        Mutation[`update${typeName}`] = async (_: any, args: { id: any; input: Record<string, any> }) => {
            const { sql, params } = crud.update(args.id, args.input);
            const result = await query(sql, params);
            return result.rows[0] || null;
        };

        // Delete
        Mutation[`delete${typeName}`] = async (_: any, args: { id: any }) => {
            const { sql, params } = crud.delete(args.id);
            const result = await query(sql, params);
            return result.rows[0] || null;
        };
    }

    return { Query, Mutation };
}
