/**
 * MCP Tools for ER Diagram Operations
 */

import { z } from 'zod';
import { parseERDiagram, validateERDiagram } from '../parser/index.js';
import { loadDiagramFromConfig } from '../config.js';
import {
    DatabaseSchema,
    Entity,
    Relationship,
    CARDINALITY_DESCRIPTIONS
} from '../types/schema.js';

/**
 * Tool definitions for the MCP server
 */
export const tools = {
    parse_er_diagram: {
        description: 'Parse a Mermaid ER diagram and extract the complete database schema including entities, attributes, and relationships.',
        inputSchema: z.object({
            diagram: z.string().optional().describe('The Mermaid ER diagram text. If not provided, will use configured diagram source.'),
        }),
        handler: async (args: { diagram?: string }) => {
            let diagramContent = args.diagram;

            if (!diagramContent) {
                diagramContent = await loadDiagramFromConfig();
            }

            if (!diagramContent) {
                return {
                    success: false,
                    error: 'No diagram provided and no diagram source configured. Please provide a diagram or configure MERMAID_DIAGRAM_PATH or MERMAID_DIAGRAM_URL.',
                };
            }

            const result = parseERDiagram(diagramContent);

            if (!result.success || !result.schema) {
                return {
                    success: false,
                    errors: result.errors,
                };
            }

            return {
                success: true,
                schema: formatSchema(result.schema),
            };
        },
    },

    list_entities: {
        description: 'List all entities (tables) in the ER diagram with their names and aliases.',
        inputSchema: z.object({
            diagram: z.string().optional().describe('The Mermaid ER diagram text. If not provided, will use configured diagram source.'),
        }),
        handler: async (args: { diagram?: string }) => {
            let diagramContent = args.diagram;

            if (!diagramContent) {
                diagramContent = await loadDiagramFromConfig();
            }

            if (!diagramContent) {
                return {
                    success: false,
                    error: 'No diagram provided and no diagram source configured.',
                };
            }

            const result = parseERDiagram(diagramContent);

            if (!result.schema) {
                return {
                    success: false,
                    errors: result.errors,
                };
            }

            return {
                success: true,
                entities: result.schema.entities.map(e => ({
                    name: e.name,
                    alias: e.alias,
                    attributeCount: e.attributes.length,
                })),
                totalCount: result.schema.entities.length,
            };
        },
    },

    get_entity_details: {
        description: 'Get detailed information about a specific entity including all its attributes, types, and keys (PK, FK, UK).',
        inputSchema: z.object({
            entityName: z.string().describe('The name of the entity to get details for.'),
            diagram: z.string().optional().describe('The Mermaid ER diagram text. If not provided, will use configured diagram source.'),
        }),
        handler: async (args: { entityName: string; diagram?: string }) => {
            let diagramContent = args.diagram;

            if (!diagramContent) {
                diagramContent = await loadDiagramFromConfig();
            }

            if (!diagramContent) {
                return {
                    success: false,
                    error: 'No diagram provided and no diagram source configured.',
                };
            }

            const result = parseERDiagram(diagramContent);

            if (!result.schema) {
                return {
                    success: false,
                    errors: result.errors,
                };
            }

            const entity = result.schema.entities.find(
                e => e.name.toLowerCase() === args.entityName.toLowerCase()
            );

            if (!entity) {
                return {
                    success: false,
                    error: `Entity "${args.entityName}" not found. Available entities: ${result.schema.entities.map(e => e.name).join(', ')}`,
                };
            }

            // Get relationships involving this entity
            const relatedRelationships = result.schema.relationships.filter(
                r => r.firstEntity.toLowerCase() === args.entityName.toLowerCase() ||
                    r.secondEntity.toLowerCase() === args.entityName.toLowerCase()
            );

            return {
                success: true,
                entity: formatEntity(entity),
                relationships: relatedRelationships.map(formatRelationship),
            };
        },
    },

    get_relationships: {
        description: 'Get all relationships between entities in the ER diagram with cardinality information.',
        inputSchema: z.object({
            diagram: z.string().optional().describe('The Mermaid ER diagram text. If not provided, will use configured diagram source.'),
            entityName: z.string().optional().describe('Filter relationships by entity name (shows all relationships involving this entity).'),
        }),
        handler: async (args: { diagram?: string; entityName?: string }) => {
            let diagramContent = args.diagram;

            if (!diagramContent) {
                diagramContent = await loadDiagramFromConfig();
            }

            if (!diagramContent) {
                return {
                    success: false,
                    error: 'No diagram provided and no diagram source configured.',
                };
            }

            const result = parseERDiagram(diagramContent);

            if (!result.schema) {
                return {
                    success: false,
                    errors: result.errors,
                };
            }

            let relationships = result.schema.relationships;

            if (args.entityName) {
                relationships = relationships.filter(
                    r => r.firstEntity.toLowerCase() === args.entityName!.toLowerCase() ||
                        r.secondEntity.toLowerCase() === args.entityName!.toLowerCase()
                );
            }

            return {
                success: true,
                relationships: relationships.map(formatRelationship),
                totalCount: relationships.length,
            };
        },
    },

    validate_diagram: {
        description: 'Validate a Mermaid ER diagram for syntax errors and structural issues.',
        inputSchema: z.object({
            diagram: z.string().describe('The Mermaid ER diagram text to validate.'),
        }),
        handler: async (args: { diagram: string }) => {
            const validation = validateERDiagram(args.diagram);

            return {
                valid: validation.valid,
                errors: validation.errors.length > 0 ? validation.errors : undefined,
                message: validation.valid
                    ? 'Diagram is valid.'
                    : `Found ${validation.errors.length} issue(s).`,
            };
        },
    },
};

/**
 * Format schema for output
 */
function formatSchema(schema: DatabaseSchema) {
    return {
        entities: schema.entities.map(formatEntity),
        relationships: schema.relationships.map(formatRelationship),
        summary: {
            entityCount: schema.entities.length,
            relationshipCount: schema.relationships.length,
            totalAttributes: schema.entities.reduce((sum, e) => sum + e.attributes.length, 0),
        },
    };
}

/**
 * Format entity for output
 */
function formatEntity(entity: Entity) {
    return {
        name: entity.name,
        alias: entity.alias,
        attributes: entity.attributes.map(attr => ({
            name: attr.name,
            type: attr.type,
            isPrimaryKey: attr.keys.includes('PK'),
            isForeignKey: attr.keys.includes('FK'),
            isUnique: attr.keys.includes('UK'),
            keys: attr.keys,
            comment: attr.comment,
        })),
        primaryKeys: entity.attributes.filter(a => a.keys.includes('PK')).map(a => a.name),
        foreignKeys: entity.attributes.filter(a => a.keys.includes('FK')).map(a => a.name),
    };
}

/**
 * Format relationship for output
 */
function formatRelationship(rel: Relationship) {
    return {
        from: rel.firstEntity,
        to: rel.secondEntity,
        fromCardinality: rel.firstCardinality,
        toCardinality: rel.secondCardinality,
        fromDescription: CARDINALITY_DESCRIPTIONS[rel.firstCardinality],
        toDescription: CARDINALITY_DESCRIPTIONS[rel.secondCardinality],
        identifying: rel.identifying,
        label: rel.label,
        description: `${rel.firstEntity} has ${CARDINALITY_DESCRIPTIONS[rel.secondCardinality]} ${rel.secondEntity} (${rel.label})`,
    };
}
