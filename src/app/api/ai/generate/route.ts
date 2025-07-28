/**
 * @swagger
 * /api/ai/generate:
 *   post:
 *     summary: Generate AI content
 *     description: Generate email marketing content using AI
 *     tags: [AI Integration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - context
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [subject_line, email_content, preheader, campaign_name, product_description]
 *                 description: Type of content to generate
 *               context:
 *                 type: object
 *                 properties:
 *                   audience:
 *                     type: string
 *                     description: Target audience description
 *                   tone:
 *                     type: string
 *                     enum: [professional, casual, friendly, urgent, promotional]
 *                     description: Content tone
 *                   industry:
 *                     type: string
 *                     description: Industry or business sector
 *                   productName:
 *                     type: string
 *                     description: Product or service name
 *                   campaignGoal:
 *                     type: string
 *                     description: Campaign objective
 *                   keywords:
 *                     type: array
 *                     items:
 *                       type: string
 *                     description: Keywords to include
 *                   existingContent:
 *                     type: string
 *                     description: Existing content for reference
 *                   brandVoice:
 *                     type: string
 *                     description: Brand voice guidelines
 *               options:
 *                 type: object
 *                 properties:
 *                   variations:
 *                     type: integer
 *                     minimum: 1
 *                     maximum: 5
 *                     description: Number of variations to generate
 *                   maxLength:
 *                     type: integer
 *                     description: Maximum content length
 *                   includeEmojis:
 *                     type: boolean
 *                     description: Whether to include emojis
 *                   language:
 *                     type: string
 *                     description: Content language
 *               provider:
 *                 type: string
 *                 enum: [openai, deepseek, openrouter]
 *                 description: AI provider to use
 *     responses:
 *       200:
 *         description: Content generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     content:
 *                       type: array
 *                       items:
 *                         type: string
 *                     metadata:
 *                       type: object
 *                       properties:
 *                         provider:
 *                           type: string
 *                         model:
 *                           type: string
 *                         tokensUsed:
 *                           type: integer
 *                         processingTime:
 *                           type: integer
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
const generateContentSchema = z.object({
  type: z.enum(['subject_line', 'email_content', 'preheader', 'campaign_name', 'product_description']),
  context: z.object({
    audience: z.string().optional(),
    tone: z.enum(['professional', 'casual', 'friendly', 'urgent', 'promotional']).optional(),
    industry: z.string().optional(),
    productName: z.string().optional(),
    campaignGoal: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    existingContent: z.string().optional(),
    brandVoice: z.string().optional()
  }),
  options: z.object({
    variations: z.number().min(1).max(5).optional(),
    maxLength: z.number().optional(),
    includeEmojis: z.boolean().optional(),
    language: z.string().optional()
  }).optional(),
  provider: z.enum(['openai', 'deepseek', 'openrouter']).optional()
})

/**
 * POST /api/ai/generate
 * Generate AI content
 */
async function generateContent(request: NextRequest) {
  try {
    const tenantId = requireTenantId(request)
    
    const body = await request.json()
    const validatedData = generateContentSchema.parse(body)
    
    const aiService = new AIIntegrationService()
    const result = await aiService.generateContent(
      validatedData,
      validatedData.provider || 'openai'
    )
    
    if (!result.success) {
      return createErrorResponse(result.error || 'Content generation failed', 500)
    }
    
    return createSuccessResponse(
      result,
      'Content generated successfully'
    )
  } catch (error: any) {
    console.error('Error generating AI content:', error)
    
    if (error instanceof z.ZodError) {
      return createErrorResponse('Invalid request data', 400, error.issues)
    }
    
    return createErrorResponse('Failed to generate content', 500)
  }
}

// Apply RBAC middleware
export const POST = withPermission(
  createApiRoute(generateContent, {
    rateLimit: { windowMs: 60000, maxRequests: 20 }
  }),
  Resource.CAMPAIGNS,
  Action.CREATE
)