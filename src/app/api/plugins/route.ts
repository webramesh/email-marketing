/**
 * @swagger
 * /api/plugins:
 *   get:
 *     summary: Get all plugins
 *     description: Retrieve all installed plugins for the current tenant
 *     tags: [Plugins]
 *     parameters:
 *       - name: category
 *         in: query
 *         schema:
 *           type: string
 *           enum: [AI, ANALYTICS, AUTOMATION, INTEGRATION, EMAIL_PROVIDER, PAYMENT, STORAGE, UTILITY]
 *         description: Filter by plugin category
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, ERROR, UPDATING]
 *         description: Filter by plugin status
 *     responses:
 *       200:
 *         description: List of plugins
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       pluginId:
 *                         type: string
 *                       name:
 *                         type: string
 *                       version:
 *                         type: string
 *                       description:
 *                         type: string
 *                       author:
 *                         type: string
 *                       category:
 *                         type: string
 *                       status:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *   post:
 *     summary: Install plugin
 *     description: Install a new plugin from manifest
 *     tags: [Plugins]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - manifest
 *             properties:
 *               manifest:
 *                 type: object
 *                 description: Plugin manifest
 *               config:
 *                 type: object
 *                 description: Plugin configuration values
 *     responses:
 *       201:
 *         description: Plugin installed successfully
 */

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/rbac/authorization';
import { Resource, Action } from '@/lib/rbac/permissions';
import { PluginService } from '@/services/plugin.service';
import { PluginCategory, PluginStatus } from '@/lib/plugins';
import {
  createApiRoute,
  createSuccessResponse,
  createErrorResponse,
  requireTenantId,
  validateQueryParams,
} from '@/lib/api';
import { z } from 'zod';

// Validation schemas
const querySchema = z.object({
  category: z.nativeEnum(PluginCategory).optional(),
  status: z.nativeEnum(PluginStatus).optional(),
});

const installPluginSchema = z.object({
  manifest: z.object({
    id: z.string(),
    name: z.string(),
    version: z.string(),
    description: z.string(),
    author: z.string(),
    category: z.nativeEnum(PluginCategory),
    main: z.string(),
    config: z.record(z.string(), z.any()),
    hooks: z.array(z.any()),
    permissions: z.array(z.string()),
    dependencies: z.array(z.string()).optional(),
    minPlatformVersion: z.string().optional(),
    maxPlatformVersion: z.string().optional(),
  }),
  config: z.record(z.string(), z.any()).optional(),
});

/**
 * GET /api/plugins
 * Get all plugins for the current tenant
 */
async function getPlugins(request: NextRequest) {
  try {
    const tenantId = requireTenantId(request);

    const { category, status } = validateQueryParams(request, querySchema);

    const plugins = await PluginService.getPlugins(tenantId, category, status);

    return createSuccessResponse(plugins, 'Plugins retrieved successfully');
  } catch (error) {
    console.error('Error fetching plugins:', error);
    return createErrorResponse('Failed to fetch plugins', 500);
  }
}

/**
 * POST /api/plugins
 * Install a new plugin
 */
async function installPlugin(request: NextRequest) {
  try {
    const tenantId = requireTenantId(request);

    const body = await request.json();
    const { manifest, config } = installPluginSchema.parse(body);

    const plugin = await PluginService.installPlugin(tenantId, manifest, config || {});

    return createSuccessResponse(plugin, 'Plugin installed successfully', 201);
  } catch (error: any) {
    console.error('Error installing plugin:', error);

    if (error instanceof z.ZodError) {
      return createErrorResponse('Invalid request data', 400, error.issues);
    }

    if (
      error.message.includes('Invalid') ||
      error.message.includes('already installed') ||
      error.message.includes('not compatible')
    ) {
      return createErrorResponse(error.message, 400);
    }

    return createErrorResponse('Failed to install plugin', 500);
  }
}

// Apply RBAC middleware to route handlers
export const GET = withPermission(
  createApiRoute(getPlugins, {
    rateLimit: { windowMs: 60000, maxRequests: 100 },
  }),
  Resource.SYSTEM_SETTINGS,
  Action.READ
);

export const POST = withPermission(
  createApiRoute(installPlugin, {
    rateLimit: { windowMs: 60000, maxRequests: 5 },
  }),
  Resource.SYSTEM_SETTINGS,
  Action.MANAGE
);
