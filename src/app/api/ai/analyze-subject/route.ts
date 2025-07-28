/**
 * @swagger
 * /api/ai/analyze-subject:
 *   post:
 *     summary: Analyze subject line
 *     description: Analyze email subject line for performance prediction
 *     tags: [AI Integration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subjectLine
 *             properties:
 *               subjectLine:
 *                 type: string
 *                 description: Subject line to analyze
 *     responses:
 *       200:
 *         description: Subject line analyzed successfully
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
 *                     score:
 *                       type: number
 *                       description: Overall score (0-100)
 *                     length:
 *                       type: number
 *                       description: Character length
 *                     wordCount:
 *                       type: number
 *                       description: Word count
 *                     hasEmojis:
 *                       type: boolean
 *                       description: Contains emojis
 *                     hasNumbers:
 *                       type: boolean
 *                       description: Contains numbers
 *                     spamScore:
 *                       type: number
 *                       description: Spam likelihood (0-100)
 *                     sentiment:
 *                       type: string
 *                       enum: [positive, negative, neutral]
 *                       description: Sentiment analysis
 *                     suggestions:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Improvement suggestions
 *                     predictions:
 *                       type: object
 *                       properties:
 *                         openRate:
 *                           type: number
 *                           description: Predicted open rate
 *                         deliverabilityScore:
 *                           type: number
 *                           description: Predicted deliverability score
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
const analyzeSubjectSchema = z.object({
  subjectLine: z.string().min(1, 'Subject line is required').max(200)
})

/**
 * POST /api/ai/analyze-subject
 * Analyze subject line
 */
async function analyzeSubjectLine(request: NextRequest) {
  try {
    const tenantId = requireTenantId(request)
    
    const body = await request.json()
    const { subjectLine } = analyzeSubjectSchema.parse(body)
    
    const aiService = new AIIntegrationService()
    const analysis = await aiService.analyzeSubjectLine(subjectLine)
    
    return createSuccessResponse(
      analysis,
      'Subject line analyzed successfully'
    )
  } catch (error: any) {
    console.error('Error analyzing subject line:', error)
    
    if (error instanceof z.ZodError) {
      return createErrorResponse('Invalid request data', 400, error.issues)
    }
    
    return createErrorResponse('Failed to analyze subject line', 500)
  }
}

// Apply RBAC middleware
export const POST = withPermission(
  createApiRoute(analyzeSubjectLine, {
    rateLimit: { windowMs: 60000, maxRequests: 50 }
  }),
  Resource.CAMPAIGNS,
  Action.READ
)