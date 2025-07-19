import { prisma } from '@/lib/prisma'
import { CampaignVariant } from '@/types'

export interface ABTestConfig {
  testName: string
  variants: Array<{
    name: string
    subject: string
    preheader?: string
    content: string
    templateData?: any
    percentage: number
  }>
  testDuration?: number // in hours
  winnerCriteria: 'open_rate' | 'click_rate' | 'conversion_rate'
  confidenceLevel: number // 0.95 for 95% confidence
  minimumSampleSize?: number
}

export interface ABTestResults {
  testId: string
  isComplete: boolean
  hasWinner: boolean
  winner?: {
    variantId: string
    variantName: string
    metric: number
    improvement: number
  }
  variants: Array<{
    variantId: string
    variantName: string
    totalSent: number
    opens: number
    clicks: number
    conversions: number
    openRate: number
    clickRate: number
    conversionRate: number
    confidenceInterval?: {
      lower: number
      upper: number
    }
  }>
  statisticalSignificance: {
    isSignificant: boolean
    pValue: number
    confidenceLevel: number
    zScore: number
  }
  recommendations: string[]
}

export class ABTestingService {
  /**
   * Create A/B test variants for a campaign
   */
  static async createABTestVariants(
    tenantId: string,
    campaignId: string,
    config: ABTestConfig
  ): Promise<CampaignVariant[]> {
    // Validate percentages add up to 100
    const totalPercentage = config.variants.reduce((sum, variant) => sum + variant.percentage, 0)
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new Error('Variant percentages must add up to 100%')
    }

    // Create variants in database
    const variants = await Promise.all(
      config.variants.map(async (variantConfig) => {
        return await prisma.campaignVariant.create({
          data: {
            campaignId,
            name: variantConfig.name,
            subject: variantConfig.subject,
            preheader: variantConfig.preheader,
            content: variantConfig.content,
            templateData: variantConfig.templateData || null,
            percentage: variantConfig.percentage
          }
        })
      })
    )

    // Update campaign to mark as A/B test
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        isAbTest: true,
        abTestSettings: {
          testName: config.testName,
          testDuration: config.testDuration,
          winnerCriteria: config.winnerCriteria,
          confidenceLevel: config.confidenceLevel,
          minimumSampleSize: config.minimumSampleSize || 100
        }
      }
    })

    return variants as CampaignVariant[]
  }

  /**
   * Update variant statistics
   */
  static async updateVariantStats(
    variantId: string,
    stats: {
      totalSent?: number
      totalDelivered?: number
      totalOpened?: number
      totalClicked?: number
      totalUnsubscribed?: number
      totalBounced?: number
      totalComplained?: number
    }
  ): Promise<void> {
    await prisma.campaignVariant.update({
      where: { id: variantId },
      data: {
        ...stats,
        updatedAt: new Date()
      }
    })
  }

  /**
   * Calculate A/B test results with statistical significance
   */
  static async calculateABTestResults(
    tenantId: string,
    campaignId: string
  ): Promise<ABTestResults> {
    // Get campaign and variants
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
      include: {
        abTestVariants: true
      }
    })

    if (!campaign || !campaign.isAbTest || !campaign.abTestVariants.length) {
      throw new Error('Campaign is not an A/B test or has no variants')
    }

    const variants = campaign.abTestVariants
    const abTestSettings = campaign.abTestSettings as any

    // Calculate metrics for each variant
    const variantResults = variants.map(variant => {
      const openRate = variant.totalSent > 0 ? (variant.totalOpened / variant.totalSent) * 100 : 0
      const clickRate = variant.totalSent > 0 ? (variant.totalClicked / variant.totalSent) * 100 : 0
      const conversionRate = variant.totalSent > 0 ? (variant.totalClicked / variant.totalSent) * 100 : 0 // Using clicks as conversions for now

      return {
        variantId: variant.id,
        variantName: variant.name,
        totalSent: variant.totalSent,
        opens: variant.totalOpened,
        clicks: variant.totalClicked,
        conversions: variant.totalClicked, // Using clicks as conversions
        openRate,
        clickRate,
        conversionRate
      }
    })

    // Determine the metric to compare based on winner criteria
    const getMetricValue = (variant: typeof variantResults[0]) => {
      switch (abTestSettings.winnerCriteria) {
        case 'open_rate':
          return variant.openRate
        case 'click_rate':
          return variant.clickRate
        case 'conversion_rate':
          return variant.conversionRate
        default:
          return variant.openRate
      }
    }

    // Find the best performing variant
    const bestVariant = variantResults.reduce((best, current) => 
      getMetricValue(current) > getMetricValue(best) ? current : best
    )

    // Calculate statistical significance between best and second best
    const otherVariants = variantResults.filter(v => v.variantId !== bestVariant.variantId)
    const secondBest = otherVariants.length > 0 
      ? otherVariants.reduce((best, current) => 
          getMetricValue(current) > getMetricValue(best) ? current : best
        )
      : null

    let statisticalSignificance = {
      isSignificant: false,
      pValue: 1,
      confidenceLevel: abTestSettings.confidenceLevel || 0.95,
      zScore: 0
    }

    if (secondBest && bestVariant.totalSent >= (abTestSettings.minimumSampleSize || 100)) {
      const significance = this.calculateStatisticalSignificance(
        bestVariant,
        secondBest,
        abTestSettings.winnerCriteria,
        abTestSettings.confidenceLevel || 0.95
      )
      statisticalSignificance = significance
    }

    // Determine if test is complete and has a winner
    const isComplete = this.isTestComplete(campaign, variants, abTestSettings)
    const hasWinner = isComplete && statisticalSignificance.isSignificant

    // Calculate improvement percentage
    const improvement = secondBest 
      ? ((getMetricValue(bestVariant) - getMetricValue(secondBest)) / getMetricValue(secondBest)) * 100
      : 0

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      variantResults,
      statisticalSignificance,
      abTestSettings
    )

    // Update winner if test is complete and significant
    if (hasWinner) {
      await prisma.campaignVariant.update({
        where: { id: bestVariant.variantId },
        data: { isWinner: true }
      })
    }

    return {
      testId: campaignId,
      isComplete,
      hasWinner,
      winner: hasWinner ? {
        variantId: bestVariant.variantId,
        variantName: bestVariant.variantName,
        metric: getMetricValue(bestVariant),
        improvement
      } : undefined,
      variants: variantResults,
      statisticalSignificance,
      recommendations
    }
  }

  /**
   * Calculate statistical significance using Z-test for proportions
   */
  private static calculateStatisticalSignificance(
    variantA: any,
    variantB: any,
    criteria: string,
    confidenceLevel: number
  ) {
    // Get success counts and sample sizes based on criteria
    let successA: number, successB: number, sampleA: number, sampleB: number

    switch (criteria) {
      case 'open_rate':
        successA = variantA.opens
        successB = variantB.opens
        break
      case 'click_rate':
        successA = variantA.clicks
        successB = variantB.clicks
        break
      case 'conversion_rate':
        successA = variantA.conversions
        successB = variantB.conversions
        break
      default:
        successA = variantA.opens
        successB = variantB.opens
    }

    sampleA = variantA.totalSent
    sampleB = variantB.totalSent

    if (sampleA === 0 || sampleB === 0) {
      return {
        isSignificant: false,
        pValue: 1,
        confidenceLevel,
        zScore: 0
      }
    }

    // Calculate proportions
    const p1 = successA / sampleA
    const p2 = successB / sampleB

    // Calculate pooled proportion
    const pooledP = (successA + successB) / (sampleA + sampleB)

    // Calculate standard error
    const se = Math.sqrt(pooledP * (1 - pooledP) * (1/sampleA + 1/sampleB))

    // Calculate Z-score
    const zScore = Math.abs(p1 - p2) / se

    // Calculate p-value (two-tailed test)
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)))

    // Determine significance
    const alpha = 1 - confidenceLevel
    const isSignificant = pValue < alpha

    return {
      isSignificant,
      pValue,
      confidenceLevel,
      zScore
    }
  }

  /**
   * Normal cumulative distribution function approximation
   */
  private static normalCDF(x: number): number {
    // Abramowitz and Stegun approximation
    const t = 1 / (1 + 0.2316419 * Math.abs(x))
    const d = 0.3989423 * Math.exp(-x * x / 2)
    const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
    
    return x > 0 ? 1 - prob : prob
  }

  /**
   * Check if A/B test is complete
   */
  private static isTestComplete(campaign: any, variants: any[], settings: any): boolean {
    // Check if test duration has passed
    if (settings.testDuration && campaign.sentAt) {
      const testEndTime = new Date(campaign.sentAt.getTime() + settings.testDuration * 60 * 60 * 1000)
      if (new Date() < testEndTime) {
        return false
      }
    }

    // Check if minimum sample size is reached
    const minSampleSize = settings.minimumSampleSize || 100
    const hasMinimumSample = variants.every(variant => variant.totalSent >= minSampleSize)

    return hasMinimumSample
  }

  /**
   * Generate recommendations based on test results
   */
  private static generateRecommendations(
    variants: any[],
    significance: any,
    settings: any
  ): string[] {
    const recommendations: string[] = []

    if (!significance.isSignificant) {
      recommendations.push('The test results are not statistically significant. Consider running the test longer or with a larger sample size.')
    }

    if (variants.some(v => v.totalSent < (settings.minimumSampleSize || 100))) {
      recommendations.push('Some variants have not reached the minimum sample size. Continue the test for more reliable results.')
    }

    const bestVariant = variants.reduce((best, current) => 
      current[settings.winnerCriteria.replace('_rate', 'Rate')] > best[settings.winnerCriteria.replace('_rate', 'Rate')] 
        ? current : best
    )

    if (significance.isSignificant) {
      recommendations.push(`Variant "${bestVariant.variantName}" is the clear winner. Consider using this variant for future campaigns.`)
    }

    // Performance insights
    const avgOpenRate = variants.reduce((sum, v) => sum + v.openRate, 0) / variants.length
    const avgClickRate = variants.reduce((sum, v) => sum + v.clickRate, 0) / variants.length

    if (avgOpenRate < 20) {
      recommendations.push('Overall open rates are low. Consider testing different subject lines or sender names.')
    }

    if (avgClickRate < 2) {
      recommendations.push('Click rates are low. Consider testing different call-to-action buttons or content layout.')
    }

    return recommendations
  }

  /**
   * Get A/B test dashboard data
   */
  static async getABTestDashboard(tenantId: string) {
    const abTests = await prisma.campaign.findMany({
      where: {
        tenantId,
        isAbTest: true
      },
      include: {
        abTestVariants: true
      },
      orderBy: { createdAt: 'desc' }
    })

    const dashboardData = await Promise.all(
      abTests.map(async (campaign) => {
        const results = await this.calculateABTestResults(tenantId, campaign.id)
        return {
          campaignId: campaign.id,
          campaignName: campaign.name,
          status: campaign.status,
          createdAt: campaign.createdAt,
          results
        }
      })
    )

    return dashboardData
  }

  /**
   * Automatically declare winner and send to remaining audience
   */
  static async declareWinnerAndSend(
    tenantId: string,
    campaignId: string
  ): Promise<{ success: boolean; winnerId?: string; message: string }> {
    const results = await this.calculateABTestResults(tenantId, campaignId)

    if (!results.hasWinner) {
      return {
        success: false,
        message: 'No statistically significant winner found'
      }
    }

    // Update campaign with winner variant content
    const winnerVariant = await prisma.campaignVariant.findUnique({
      where: { id: results.winner!.variantId }
    })

    if (!winnerVariant) {
      return {
        success: false,
        message: 'Winner variant not found'
      }
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        subject: winnerVariant.subject,
        preheader: winnerVariant.preheader,
        content: winnerVariant.content,
        templateData: winnerVariant.templateData as any
      }
    })

    return {
      success: true,
      winnerId: winnerVariant.id,
      message: `Winner declared: ${winnerVariant.name}. Campaign updated with winning variant.`
    }
  }
}