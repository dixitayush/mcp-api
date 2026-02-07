/**
 * REST Router
 * 
 * Dynamically generates Express routes for CRUD operations on all entities
 */

import { Router, Request, Response } from 'express';
import { DatabaseSchema, Entity } from '../types/schema.js';
import { query } from '../database/index.js';
import { createCrudQueries } from '../database/queryBuilder.js';
import { toTableName } from '../database/sqlGenerator.js';
import { logger } from '../config.js';

/**
 * Create CRUD routes for a single entity
 */
function createEntityRouter(entity: Entity): Router {
    const router = Router();
    const crud = createCrudQueries(entity);
    const entityName = toTableName(entity.name);

    // GET / - List all records
    router.get('/', async (req: Request, res: Response) => {
        try {
            const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
            const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
            const orderBy = req.query.orderBy as string | undefined;
            const orderDir = (req.query.orderDir as 'ASC' | 'DESC') || 'ASC';

            const { sql, params } = crud.selectAll({ limit, offset, orderBy, orderDir });
            const result = await query(sql, params);

            // Get total count
            const countQuery = crud.count();
            const countResult = await query(countQuery.sql, countQuery.params);
            const total = parseInt(countResult.rows[0]?.count || '0', 10);

            res.json({
                data: result.rows,
                meta: {
                    total,
                    count: result.rows.length,
                    limit,
                    offset,
                },
            });
        } catch (error: any) {
            logger.error(`GET /${entityName} failed:`, error);
            res.status(500).json({ error: error.message });
        }
    });

    // GET /:id - Get single record by ID
    router.get('/:id', async (req: Request, res: Response) => {
        try {
            const { sql, params } = crud.selectById(req.params.id);
            const result = await query(sql, params);

            if (result.rows.length === 0) {
                res.status(404).json({ error: 'Not found' });
                return;
            }

            res.json({ data: result.rows[0] });
        } catch (error: any) {
            logger.error(`GET /${entityName}/:id failed:`, error);
            res.status(500).json({ error: error.message });
        }
    });

    // POST / - Create new record
    router.post('/', async (req: Request, res: Response) => {
        try {
            const { sql, params } = crud.insert(req.body);
            const result = await query(sql, params);

            res.status(201).json({ data: result.rows[0] });
        } catch (error: any) {
            logger.error(`POST /${entityName} failed:`, error);
            res.status(500).json({ error: error.message });
        }
    });

    // PUT /:id - Update record
    router.put('/:id', async (req: Request, res: Response) => {
        try {
            const { sql, params } = crud.update(req.params.id, req.body);
            const result = await query(sql, params);

            if (result.rows.length === 0) {
                res.status(404).json({ error: 'Not found' });
                return;
            }

            res.json({ data: result.rows[0] });
        } catch (error: any) {
            logger.error(`PUT /${entityName}/:id failed:`, error);
            res.status(500).json({ error: error.message });
        }
    });

    // PATCH /:id - Partial update record
    router.patch('/:id', async (req: Request, res: Response) => {
        try {
            const { sql, params } = crud.update(req.params.id, req.body);
            const result = await query(sql, params);

            if (result.rows.length === 0) {
                res.status(404).json({ error: 'Not found' });
                return;
            }

            res.json({ data: result.rows[0] });
        } catch (error: any) {
            logger.error(`PATCH /${entityName}/:id failed:`, error);
            res.status(500).json({ error: error.message });
        }
    });

    // DELETE /:id - Delete record
    router.delete('/:id', async (req: Request, res: Response) => {
        try {
            const { sql, params } = crud.delete(req.params.id);
            const result = await query(sql, params);

            if (result.rows.length === 0) {
                res.status(404).json({ error: 'Not found' });
                return;
            }

            res.json({ data: result.rows[0], message: 'Deleted successfully' });
        } catch (error: any) {
            logger.error(`DELETE /${entityName}/:id failed:`, error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
}

/**
 * Create the main API router with routes for all entities
 */
export function createRestRouter(schema: DatabaseSchema): {
    router: Router;
    endpoints: Array<{ method: string; path: string; entity: string }>;
} {
    const router = Router();
    const endpoints: Array<{ method: string; path: string; entity: string }> = [];

    for (const entity of schema.entities) {
        const entityPath = `/${toTableName(entity.name)}`;
        const entityRouter = createEntityRouter(entity);

        router.use(entityPath, entityRouter);

        // Track endpoints
        const methods = ['GET', 'POST'];
        const idMethods = ['GET', 'PUT', 'PATCH', 'DELETE'];

        for (const method of methods) {
            endpoints.push({
                method,
                path: `/api${entityPath}`,
                entity: entity.name,
            });
        }

        for (const method of idMethods) {
            endpoints.push({
                method,
                path: `/api${entityPath}/:id`,
                entity: entity.name,
            });
        }
    }

    return { router, endpoints };
}
