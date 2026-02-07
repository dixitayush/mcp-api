/**
 * Quick test script to verify the parser works
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseERDiagram } from './parser/index.js';

// Read sample diagram - use process.cwd() for compatibility
const samplePath = resolve(process.cwd(), 'examples/sample-er.mmd');
const diagramContent = readFileSync(samplePath, 'utf-8');

console.log('=== MCP Mermaid ER Server - Parser Test ===\n');
console.log('Parsing sample-er.mmd...\n');

const result = parseERDiagram(diagramContent);

if (result.success && result.schema) {
    console.log('✅ Parsing successful!\n');

    console.log(`📊 Schema Summary:`);
    console.log(`   - Entities: ${result.schema.entities.length}`);
    console.log(`   - Relationships: ${result.schema.relationships.length}`);
    console.log(`   - Total Attributes: ${result.schema.entities.reduce((sum, e) => sum + e.attributes.length, 0)}`);

    console.log('\n📁 Entities:');
    for (const entity of result.schema.entities) {
        const pkAttrs = entity.attributes.filter(a => a.keys.includes('PK')).map(a => a.name);
        const fkAttrs = entity.attributes.filter(a => a.keys.includes('FK')).map(a => a.name);
        console.log(`   - ${entity.name}: ${entity.attributes.length} attrs, PK: [${pkAttrs.join(', ')}], FK: [${fkAttrs.join(', ')}]`);
    }

    console.log('\n🔗 Relationships:');
    for (const rel of result.schema.relationships) {
        const relType = rel.identifying ? '━━' : '╌╌';
        console.log(`   - ${rel.firstEntity} ${relType} ${rel.secondEntity}: "${rel.label}"`);
    }

    console.log('\n✅ All tests passed!');
} else {
    console.log('❌ Parsing failed!');
    console.log('Errors:', result.errors);
    process.exit(1);
}
