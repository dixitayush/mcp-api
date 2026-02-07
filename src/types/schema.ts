/**
 * Type definitions for the Mermaid ER diagram schema
 */

/**
 * Cardinality values in ER diagrams
 * - ZERO_OR_ONE: |o or o|
 * - EXACTLY_ONE: ||
 * - ZERO_OR_MORE: }o or o{
 * - ONE_OR_MORE: }| or |{
 */
export type Cardinality = 'ZERO_OR_ONE' | 'EXACTLY_ONE' | 'ZERO_OR_MORE' | 'ONE_OR_MORE';

/**
 * Key types for attributes
 */
export type AttributeKey = 'PK' | 'FK' | 'UK';

/**
 * Represents an attribute of an entity
 */
export interface Attribute {
    /** Attribute name */
    name: string;
    /** Data type of the attribute */
    type: string;
    /** Key constraints (PK, FK, UK) */
    keys: AttributeKey[];
    /** Optional comment for the attribute */
    comment?: string;
}

/**
 * Represents an entity in the ER diagram
 */
export interface Entity {
    /** Entity name (technical name) */
    name: string;
    /** Optional display alias */
    alias?: string;
    /** List of attributes */
    attributes: Attribute[];
}

/**
 * Represents a relationship between two entities
 */
export interface Relationship {
    /** Name of the first entity */
    firstEntity: string;
    /** Name of the second entity */
    secondEntity: string;
    /** Cardinality from first entity's perspective */
    firstCardinality: Cardinality;
    /** Cardinality from second entity's perspective */
    secondCardinality: Cardinality;
    /** Whether this is an identifying relationship (solid line) */
    identifying: boolean;
    /** Relationship label/description */
    label: string;
}

/**
 * The complete database schema parsed from the ER diagram
 */
export interface DatabaseSchema {
    /** All entities in the schema */
    entities: Entity[];
    /** All relationships between entities */
    relationships: Relationship[];
}

/**
 * Result of parsing an ER diagram
 */
export interface ParseResult {
    /** Whether parsing was successful */
    success: boolean;
    /** The parsed schema (if successful) */
    schema?: DatabaseSchema;
    /** Error messages (if parsing failed) */
    errors?: string[];
}

/**
 * Cardinality symbol mappings
 */
export const CARDINALITY_SYMBOLS: Record<string, Cardinality> = {
    '|o': 'ZERO_OR_ONE',
    'o|': 'ZERO_OR_ONE',
    '||': 'EXACTLY_ONE',
    '}o': 'ZERO_OR_MORE',
    'o{': 'ZERO_OR_MORE',
    '}|': 'ONE_OR_MORE',
    '|{': 'ONE_OR_MORE',
};

/**
 * Human-readable cardinality descriptions
 */
export const CARDINALITY_DESCRIPTIONS: Record<Cardinality, string> = {
    'ZERO_OR_ONE': 'zero or one',
    'EXACTLY_ONE': 'exactly one',
    'ZERO_OR_MORE': 'zero or more',
    'ONE_OR_MORE': 'one or more',
};
