/**
 * @swagger
 * /api/ai/optimize:
 *   post:
 *     summary: Optimize content with AI
 *     description: Optimize existing email marketing content using AI
 *     tags: [AI Integration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *               - type
 *               - goals
 *             properties:
 *               content:
 *                 type: string
 *                 description: Content to optimize
 *               type:
 *                 type: string
 *                 enum: [subject_line, email_content, preheader]
 *                 description: Type of content
 *               goals:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [engagement, deliverability, conversion, readability]
 *                 description: Optimization goals
 *               context:
 *                 type: object
 *                 properties:
 *                   audience:
 *                     type: string
 *                     description: Target audience
 *                   industry:
 *                     type: string
 *                     description: Industry sector
 *                   previousPerformance:
 *                     type: object
 *                     properties:
 *                       openRate:
 *                         type: number
 *                         description: Previous open rate percentage
 *                       clickRate:
 *                         type: number
 *                         description: Previous click rate percentage
 *                       conversionRate:
 *                         type: number
 *                         description: Previous conversion rate percentage
 *               provider:
 *                 type: string
 *                 enum: [openai, deepseek, openrouter]
 *                 description: AI provider to use
 *     responses:
 *       200:
 *         description: Content optimized successfully
 */

import { NextRequest } from 'next/server'
import { withPermission } from '@/lib/rbac/authorization'
import { Resource, Action } from '@/lib/rbac/permissions'
import { AIIntegrationService } from '@/services/ai-integration.service'
import { 
  createApiRoute, 
  createSuccessResponse, 
  createErrorResponse,
  requireTenantId
} from '@/lib/api'
import { z } from 'zod'

// Validation schema
const optimizeContentSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  type: z.enum(['subject_line', 'email_content', 'preheader']),
  goals: z.array(z.enum(['engagement', 'deliverability', 'conversion', 'readability'])).min(1),
  context: z.object({
    audience: z.string().optional(),
    industry: z.string().optional(),
    previousPerformance: z.object({
      openRate: z.number().optional(),
      clickRate: z.number().optional(),
      conversionRate: z.number().optional()
    }).optional()
  }).optional(),
  provider: z.enum(['openai', 'deepseek', 'openrouter']).optional()
})

/**
 * POST /api/ai/optimize
 * Optimize content with AI
 */
async function optimizeContent(request: NextRequest) {
  try {
    const tenantId = requireTenantId(request)
    
    const body = await request.json()
    const validatedData = optimizeContentSchema.parse(body)
    
    const aiService = new AIIntegrationService()
    const result = await aiService.optimizeContent(
      validatedData,
      validatedData.provider || 'openai'
    )
    
    if (!result.success) {
      return createErrorResponse(result.error || 'Content optimization failed', 500)
    }
    
    return createSuccessResponse(
      result,
      'Content optimized successfully'
    )
  } catch (error: any) {
    console.error('Error optimizing AI content:', error)
    
    if (error instanceof z.ZodError) {
      return createErrorResponse('Invalid request data', 400, error.issues)
    }
    
    return createErrorResponse('Failed to optimize content', 500)
  }
}

// Apply RBAC middleware
export const POST = withPermission(
  createApiRoute(optimizeContent, {
    rateLimit: { windowMs: 60000, maxRequests: 30 }
  }),
  Resource.CAMPAIGNS,
  Action.UPDATE
)