/**
 * Mermaid ER Diagram Parser
 * 
 * Parses Mermaid Entity-Relationship diagram syntax and extracts
 * structured schema information including entities, attributes, and relationships.
 */

import {
    Attribute,
    AttributeKey,
    Cardinality,
    DatabaseSchema,
    Entity,
    ParseResult,
    Relationship,
    CARDINALITY_SYMBOLS,
} from '../types/schema.js';

/**
 * Regular expression patterns for parsing ER diagrams
 */
const PATTERNS = {
    // Match: erDiagram
    ER_DIAGRAM_START: /^\s*erDiagram\s*$/i,

    // Match: direction TB, direction LR, etc.
    DIRECTION: /^\s*direction\s+(TB|BT|LR|RL)\s*$/i,

    // Match entity with attributes block: ENTITY_NAME { ... }
    ENTITY_BLOCK_START: /^\s*([a-zA-Z_][a-zA-Z0-9_-]*|\\"[^"]+\\")(\s*\[([^\]]+)\])?\s*\{\s*$/,
    ENTITY_BLOCK_END: /^\s*\}\s*$/,

    // Match attribute line: type name PK,FK "comment"
    ATTRIBUTE: /^\s*([a-zA-Z][a-zA-Z0-9_\-\[\]\(\)]*)\s+(\*?[a-zA-Z_][a-zA-Z0-9_-]*)(?:\s+((?:PK|FK|UK)(?:\s*,\s*(?:PK|FK|UK))*))?(?:\s+"([^"]*)")?\s*$/,

    // Match relationship: ENTITY1 ||--|{ ENTITY2 : label
    RELATIONSHIP: /^\s*([a-zA-Z_][a-zA-Z0-9_-]*|\\"[^"]+\\")\s*(\|o|o\||\|\||}\||}\o|o\{|\|\{)(\-\-|\.\.)(o\||o\{|\|\||\|o|\|{|{\||\{o)\s*([a-zA-Z_][a-zA-Z0-9_-]*|\\"[^"]+\\")\s*:\s*"?([^"]+)"?\s*$/,

    // Match standalone entity: ENTITY_NAME
    STANDALONE_ENTITY: /^\s*([a-zA-Z_][a-zA-Z0-9_-]*|\\"[^"]+\\")(\s*\[([^\]]+)\])?\s*$/,

    // Comment line
    COMMENT: /^\s*%%/,

    // Empty line
    EMPTY: /^\s*$/,
};

/**
 * Parse cardinality symbol to Cardinality type
 */
function parseCardinality(symbol: string): Cardinality {
    // Normalize symbol
    const normalized = symbol.replace(/\s/g, '');

    // Handle left-side symbols (they appear before the relationship line)
    if (normalized === '|o' || normalized === 'o|') return 'ZERO_OR_ONE';
    if (normalized === '||') return 'EXACTLY_ONE';
    if (normalized === '}o' || normalized === 'o{' || normalized === '{o') return 'ZERO_OR_MORE';
    if (normalized === '}|' || normalized === '|{' || normalized === '{|') return 'ONE_OR_MORE';

    // Default fallback
    return CARDINALITY_SYMBOLS[normalized] || 'EXACTLY_ONE';
}

/**
 * Parse attribute keys from string like "PK, FK"
 */
function parseAttributeKeys(keyString: string | undefined): AttributeKey[] {
    if (!keyString) return [];

    const keys: AttributeKey[] = [];
    const parts = keyString.split(',').map(k => k.trim().toUpperCase());

    for (const part of parts) {
        if (part === 'PK' || part === 'FK' || part === 'UK') {
            keys.push(part);
        }
    }

    return keys;
}

/**
 * Remove quotes from entity name if present
 */
function cleanEntityName(name: string): string {
    return name.replace(/^"|"$/g, '').replace(/^\\"|\\"$/g, '');
}

/**
 * Parse a Mermaid ER diagram string into structured schema
 */
export function parseERDiagram(input: string): ParseResult {
    const lines = input.split('\n');
    const entities = new Map<string, Entity>();
    const relationships: Relationship[] = [];
    const errors: string[] = [];

    let inERDiagram = false;
    let currentEntity: Entity | null = null;
    let inEntityBlock = false;
    let lineNumber = 0;

    for (const rawLine of lines) {
        lineNumber++;
        const line = rawLine.trim();

        // Skip empty lines and comments
        if (PATTERNS.EMPTY.test(line) || PATTERNS.COMMENT.test(line)) {
            continue;
        }

        // Check for erDiagram start
        if (PATTERNS.ER_DIAGRAM_START.test(line)) {
            inERDiagram = true;
            continue;
        }

        // Everything after erDiagram is diagram content
        if (!inERDiagram) {
            // Skip lines before erDiagram declaration
            continue;
        }

        // Skip direction declarations
        if (PATTERNS.DIRECTION.test(line)) {
            continue;
        }

        // Check for entity block end
        if (PATTERNS.ENTITY_BLOCK_END.test(line)) {
            if (currentEntity) {
                entities.set(currentEntity.name, currentEntity);
                currentEntity = null;
            }
            inEntityBlock = false;
            continue;
        }

        // If inside entity block, parse attributes
        if (inEntityBlock && currentEntity) {
            const attrMatch = line.match(PATTERNS.ATTRIBUTE);
            if (attrMatch) {
                const [, type, name, keys, comment] = attrMatch;
                const attribute: Attribute = {
                    type: type,
                    name: name.replace(/^\*/, ''), // Remove leading asterisk
                    keys: parseAttributeKeys(keys),
                    comment: comment,
                };

                // If name starts with *, it's a PK
                if (name.startsWith('*') && !attribute.keys.includes('PK')) {
                    attribute.keys.unshift('PK');
                }

                currentEntity.attributes.push(attribute);
            } else {
                errors.push(`Line ${lineNumber}: Unable to parse attribute: "${line}"`);
            }
            continue;
        }

        // Check for entity block start
        const entityBlockMatch = line.match(PATTERNS.ENTITY_BLOCK_START);
        if (entityBlockMatch) {
            const [, name, , alias] = entityBlockMatch;
            const cleanName = cleanEntityName(name);
            currentEntity = {
                name: cleanName,
                alias: alias ? cleanEntityName(alias) : undefined,
                attributes: [],
            };
            inEntityBlock = true;
            continue;
        }

        // Check for relationship
        const relMatch = line.match(PATTERNS.RELATIONSHIP);
        if (relMatch) {
            const [, first, leftCard, relationLine, rightCard, second, label] = relMatch;

            const firstEntityName = cleanEntityName(first);
            const secondEntityName = cleanEntityName(second);

            // Ensure entities exist
            if (!entities.has(firstEntityName)) {
                entities.set(firstEntityName, { name: firstEntityName, attributes: [] });
            }
            if (!entities.has(secondEntityName)) {
                entities.set(secondEntityName, { name: secondEntityName, attributes: [] });
            }

            relationships.push({
                firstEntity: firstEntityName,
                secondEntity: secondEntityName,
                firstCardinality: parseCardinality(leftCard),
                secondCardinality: parseCardinality(rightCard),
                identifying: relationLine === '--',
                label: label.trim().replace(/^"|"$/g, ''),
            });
            continue;
        }

        // Check for standalone entity
        const standaloneMatch = line.match(PATTERNS.STANDALONE_ENTITY);
        if (standaloneMatch) {
            const [, name, , alias] = standaloneMatch;
            const cleanName = cleanEntityName(name);
            if (!entities.has(cleanName)) {
                entities.set(cleanName, {
                    name: cleanName,
                    alias: alias ? cleanEntityName(alias) : undefined,
                    attributes: [],
                });
            }
            continue;
        }

        // If we got here, the line wasn't recognized
        // Don't add error for unrecognized lines - they might be valid Mermaid we don't support yet
    }

    // If we were still in an entity block, close it
    if (currentEntity) {
        entities.set(currentEntity.name, currentEntity);
    }

    const schema: DatabaseSchema = {
        entities: Array.from(entities.values()),
        relationships,
    };

    return {
        success: errors.length === 0,
        schema,
        errors: errors.length > 0 ? errors : undefined,
    };
}

/**
 * Validate a Mermaid ER diagram without fully parsing it
 */
export function validateERDiagram(input: string): { valid: boolean; errors: string[] } {
    const result = parseERDiagram(input);

    const errors: string[] = result.errors ? [...result.errors] : [];

    // Additional validation
    if (!input.toLowerCase().includes('erdiagram')) {
        errors.push('Diagram does not contain "erDiagram" declaration');
    }

    if (result.schema) {
        // Check for duplicate entity names
        const entityNames = result.schema.entities.map(e => e.name);
        const duplicates = entityNames.filter((name, index) => entityNames.indexOf(name) !== index);
        if (duplicates.length > 0) {
            errors.push(`Duplicate entity names: ${duplicates.join(', ')}`);
        }

        // Check for relationships referencing non-existent entities
        for (const rel of result.schema.relationships) {
            if (!entityNames.includes(rel.firstEntity)) {
                errors.push(`Relationship references non-existent entity: ${rel.firstEntity}`);
            }
            if (!entityNames.includes(rel.secondEntity)) {
                errors.push(`Relationship references non-existent entity: ${rel.secondEntity}`);
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

// Export all functions
export { parseCardinality, parseAttributeKeys, cleanEntityName };
