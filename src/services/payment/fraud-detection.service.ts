import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import {
  PaymentRequest,
  FraudCheckResult,
  PaymentSecurityConfig,
  PaymentProviderType,
} from '@/types/payment';
import { PaymentAuditLogger } from './audit-logger.service';

export interface FraudRule {
  id: string;
  name: string;
  description: string;
  riskWeight: number;
  isActive: boolean;
  conditions: FraudCondition[];
}

export interface FraudCondition {
  field: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'in' | 'not_in' | 'regex';
  value: any;
  weight: number;
}

export interface DeviceFingerprint {
  deviceId: string;
  browserFingerprint: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  plugins: string[];
  fonts: string[];
  canvas: string;
  webgl: string;
  audioContext: string;
}

export interface BehaviorAnalysis {
  sessionDuration: number;
  pageViews: number;
  mouseMovements: number;
  keystrokes: number;
  scrollEvents: number;
  formFillTime: number;
  typingPattern: number[];
  clickPattern: { x: number; y: number; timestamp: number }[];
}

export interface GeoLocationData {
  country: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isp: string;
  organization: string;
  asn: string;
  isVpn: boolean;
  isProxy: boolean;
  isTor: boolean;
  threatLevel: 'low' | 'medium' | 'high';
}

export interface TransactionVelocity {
  last1Hour: number;
  last24Hours: number;
  last7Days: number;
  last30Days: number;
  averageAmount: number;
  maxAmount: number;
  distinctCards: number;
  distinctIps: number;
}

export class FraudDetectionService {
  private static instance: FraudDetectionService;
  private auditLogger: PaymentAuditLogger;
  private securityConfig: PaymentSecurityConfig;
  private fraudRules: FraudRule[] = [];

  constructor() {
    this.auditLogger = PaymentAuditLogger.getInstance();
    this.securityConfig = this.getDefaultSecurityConfig();
    this.initializeFraudRules();
  }

  static getInstance(): FraudDetectionService {
    if (!FraudDetectionService.instance) {
      FraudDetectionService.instance = new FraudDetectionService();
    }
    return FraudDetectionService.instance;
  }

  /**
   * Perform comprehensive fraud analysis on a payment request
   */
  async performFraudCheck(
    request: PaymentRequest,
    context: {
      tenantId: string;
      userId?: string;
      ipAddress?: string;
      userAgent?: string;
      deviceFingerprint?: DeviceFingerprint;
      behaviorAnalysis?: BehaviorAnalysis;
      geoLocation?: GeoLocationData;
    }
  ): Promise<FraudCheckResult> {
    try {
      let riskScore = 0;
      const reasons: string[] = [];
      const checks = {
        cvv: true,
        address: true,
        postalCode: true,
        deviceFingerprint: false,
        ipReputation: false,
        behaviorAnalysis: false,
      };

      // 1. Amount-based risk assessment
      const amountRisk = this.assessAmountRisk(request.amount, request.currency);
      riskScore += amountRisk.score;
      if (amountRisk.reasons.length > 0) {
        reasons.push(...amountRisk.reasons);
      }

      // 2. Currency risk assessment
      const currencyRisk = this.assessCurrencyRisk(request.currency);
      riskScore += currencyRisk.score;
      if (currencyRisk.reasons.length > 0) {
        reasons.push(...currencyRisk.reasons);
      }

      // 3. Geographic risk assessment
      if (context.geoLocation) {
        const geoRisk = this.assessGeographicRisk(context.geoLocation);
        riskScore += geoRisk.score;
        if (geoRisk.reasons.length > 0) {
          reasons.push(...geoRisk.reasons);
        }
        checks.ipReputation = true;
      }

      // 4. Device fingerprinting analysis
      if (context.deviceFingerprint) {
        const deviceRisk = await this.assessDeviceRisk(
          context.deviceFingerprint,
          context.tenantId,
          context.userId
        );
        riskScore += deviceRisk.score;
        if (deviceRisk.reasons.length > 0) {
          reasons.push(...deviceRisk.reasons);
        }
        checks.deviceFingerprint = true;
      }

      // 5. Behavioral analysis
      if (context.behaviorAnalysis) {
        const behaviorRisk = this.assessBehaviorRisk(context.behaviorAnalysis);
        riskScore += behaviorRisk.score;
        if (behaviorRisk.reasons.length > 0) {
          reasons.push(...behaviorRisk.reasons);
        }
        checks.behaviorAnalysis = true;
      }

      // 6. Transaction velocity analysis
      const velocityRisk = await this.assessTransactionVelocity(
        context.tenantId,
        context.userId,
        context.ipAddress,
        request.amount
      );
      riskScore += velocityRisk.score;
      if (velocityRisk.reasons.length > 0) {
        reasons.push(...velocityRisk.reasons);
      }

      // 7. Historical fraud patterns
      const historyRisk = await this.assessHistoricalRisk(
        context.tenantId,
        context.userId,
        context.ipAddress,
        request.customerId
      );
      riskScore += historyRisk.score;
      if (historyRisk.reasons.length > 0) {
        reasons.push(...historyRisk.reasons);
      }

      // 8. Apply custom fraud rules
      const customRulesRisk = await this.applyCustomFraudRules(request, context);
      riskScore += customRulesRisk.score;
      if (customRulesRisk.reasons.length > 0) {
        reasons.push(...customRulesRisk.reasons);
      }

      // 9. Machine learning risk scoring (placeholder for ML integration)
      const mlRisk = await this.getMachineLearningRiskScore(request, context);
      riskScore += mlRisk.score;
      if (mlRisk.reasons.length > 0) {
        reasons.push(...mlRisk.reasons);
      }

      // Determine risk level and recommendation
      const { riskLevel, recommendation } = this.determineRiskLevelAndRecommendation(riskScore);

      const fraudResult: FraudCheckResult = {
        riskScore: Math.min(riskScore, 100), // Cap at 100
        riskLevel,
        checks,
        recommendation,
        reasons,
        timestamp: new Date(),
      };

      // Log fraud check result
      await this.auditLogger.logPaymentEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        type: 'fraud_detection' as any,
        provider: PaymentProviderType.STRIPE, // Default provider for fraud logging
        amount: request.amount,
        currency: request.currency,
        status: recommendation,
        fraudScore: fraudResult.riskScore,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: {
          riskLevel: fraudResult.riskLevel,
          reasons: fraudResult.reasons,
          checks: fraudResult.checks,
        },
      });

      return fraudResult;
    } catch (error) {
      console.error('Fraud detection failed:', error);

      // Return safe default in case of error
      return {
        riskScore: 50,
        riskLevel: 'medium',
        checks: {
          cvv: false,
          address: false,
          postalCode: false,
        },
        recommendation: 'review',
        reasons: ['Fraud detection system error'],
        timestamp: new Date(),
      };
    }
  }

  /**
   * Update fraud rules configuration
   */
  async updateFraudRules(tenantId: string, rules: FraudRule[]): Promise<void> {
    try {
      // Validate rules
      for (const rule of rules) {
        this.validateFraudRule(rule);
      }

      // Store rules in database (tenant-specific)
      await prisma.auditLog.create({
        data: {
          id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          tenantId,
          action: 'fraud_rules_updated',
          resource: 'payment_security',
          changes: { rules: JSON.parse(JSON.stringify(rules)) },
          metadata: { rulesCount: rules.length },
          createdAt: new Date(),
        },
      });

      // Update in-memory rules for this tenant
      this.fraudRules = rules;

      console.log(`Updated fraud rules for tenant ${tenantId}:`, rules.length);
    } catch (error) {
      console.error('Failed to update fraud rules:', error);
      throw error;
    }
  }

  /**
   * Get fraud statistics for monitoring dashboard
   */
  async getFraudStatistics(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalTransactions: number;
    fraudDetected: number;
    falsePositives: number;
    averageRiskScore: number;
    topFraudReasons: { reason: string; count: number }[];
    riskDistribution: { low: number; medium: number; high: number };
    preventedLoss: number;
  }> {
    try {
      // This would query the database for fraud statistics
      // For now, return placeholder data
      return {
        totalTransactions: 0,
        fraudDetected: 0,
        falsePositives: 0,
        averageRiskScore: 0,
        topFraudReasons: [],
        riskDistribution: { low: 0, medium: 0, high: 0 },
        preventedLoss: 0,
      };
    } catch (error) {
      console.error('Failed to get fraud statistics:', error);
      throw error;
    }
  }

  private assessAmountRisk(amount: number, currency: string): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // Convert to USD for consistent thresholds
    const usdAmount = this.convertToUSD(amount, currency);

    if (usdAmount > 50000) {
      score += 50;
      reasons.push('Extremely high transaction amount');
    } else if (usdAmount > 25000) {
      score += 40;
      reasons.push('Very high transaction amount');
    } else if (usdAmount > 10000) {
      score += 30;
      reasons.push('High transaction amount');
    } else if (usdAmount > 5000) {
      score += 20;
      reasons.push('Above average transaction amount');
    } else if (usdAmount > 1000) {
      score += 10;
      reasons.push('Moderate transaction amount');
    }

    // Unusual amounts (round numbers might be suspicious)
    if (usdAmount % 1000 === 0 && usdAmount > 1000) {
      score += 5;
      reasons.push('Suspicious round number amount');
    }

    return { score, reasons };
  }

  private assessCurrencyRisk(currency: string): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    const highRiskCurrencies = ['BTC', 'ETH', 'USDT', 'XRP', 'LTC', 'BCH', 'ADA', 'DOT'];
    const mediumRiskCurrencies = ['RUB', 'CNY', 'KRW', 'TRY', 'ARS', 'VES'];
    const lowRiskCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF'];

    if (highRiskCurrencies.includes(currency.toUpperCase())) {
      score += 25;
      reasons.push('High-risk cryptocurrency or currency');
    } else if (mediumRiskCurrencies.includes(currency.toUpperCase())) {
      score += 15;
      reasons.push('Medium-risk currency');
    } else if (!lowRiskCurrencies.includes(currency.toUpperCase())) {
      score += 10;
      reasons.push('Uncommon currency');
    }

    return { score, reasons };
  }

  private assessGeographicRisk(geoLocation: GeoLocationData): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // High-risk countries (based on fraud statistics)
    const highRiskCountries = ['AF', 'IQ', 'LY', 'SO', 'SY', 'YE', 'MM', 'KP'];
    const mediumRiskCountries = ['CN', 'RU', 'IR', 'PK', 'BD', 'NG', 'GH'];

    if (highRiskCountries.includes(geoLocation.country)) {
      score += 30;
      reasons.push('High-risk country');
    } else if (mediumRiskCountries.includes(geoLocation.country)) {
      score += 15;
      reasons.push('Medium-risk country');
    }

    // VPN/Proxy/Tor detection
    if (geoLocation.isTor) {
      score += 35;
      reasons.push('Tor network detected');
    } else if (geoLocation.isProxy) {
      score += 20;
      reasons.push('Proxy server detected');
    } else if (geoLocation.isVpn) {
      score += 15;
      reasons.push('VPN detected');
    }

    // Threat level
    if (geoLocation.threatLevel === 'high') {
      score += 25;
      reasons.push('High threat level IP');
    } else if (geoLocation.threatLevel === 'medium') {
      score += 10;
      reasons.push('Medium threat level IP');
    }

    return { score, reasons };
  }

  private async assessDeviceRisk(
    deviceFingerprint: DeviceFingerprint,
    tenantId: string,
    userId?: string
  ): Promise<{ score: number; reasons: string[] }> {
    let score = 0;
    const reasons: string[] = [];

    try {
      // Check if device is known
      const knownDevice = await this.isKnownDevice(deviceFingerprint.deviceId, tenantId, userId);
      if (!knownDevice) {
        score += 10;
        reasons.push('Unknown device');
      }

      // Check for device spoofing indicators
      if (this.detectDeviceSpoofing(deviceFingerprint)) {
        score += 25;
        reasons.push('Potential device spoofing detected');
      }

      // Check for automation/bot indicators
      if (this.detectAutomation(deviceFingerprint)) {
        score += 30;
        reasons.push('Automated/bot behavior detected');
      }

      // Check device reputation
      const deviceReputation = await this.getDeviceReputation(deviceFingerprint.deviceId);
      if (deviceReputation === 'bad') {
        score += 35;
        reasons.push('Device has bad reputation');
      } else if (deviceReputation === 'suspicious') {
        score += 20;
        reasons.push('Device has suspicious reputation');
      }

      return { score, reasons };
    } catch (error) {
      console.error('Device risk assessment failed:', error);
      return { score: 10, reasons: ['Device assessment error'] };
    }
  }

  private assessBehaviorRisk(behaviorAnalysis: BehaviorAnalysis): {
    score: number;
    reasons: string[];
  } {
    let score = 0;
    const reasons: string[] = [];

    // Extremely fast form filling (bot-like behavior)
    if (behaviorAnalysis.formFillTime < 5000) {
      // Less than 5 seconds
      score += 25;
      reasons.push('Suspiciously fast form completion');
    }

    // No mouse movements (automation)
    if (behaviorAnalysis.mouseMovements === 0) {
      score += 20;
      reasons.push('No mouse movement detected');
    }

    // Unusual typing patterns
    if (behaviorAnalysis.typingPattern.length > 0) {
      const avgTypingSpeed =
        behaviorAnalysis.typingPattern.reduce((a, b) => a + b, 0) /
        behaviorAnalysis.typingPattern.length;
      if (avgTypingSpeed < 50 || avgTypingSpeed > 500) {
        // Too slow or too fast
        score += 15;
        reasons.push('Unusual typing pattern');
      }
    }

    // Very short session duration
    if (behaviorAnalysis.sessionDuration < 30000) {
      // Less than 30 seconds
      score += 10;
      reasons.push('Very short session duration');
    }

    // No scroll events on long forms
    if (behaviorAnalysis.scrollEvents === 0 && behaviorAnalysis.formFillTime > 10000) {
      score += 10;
      reasons.push('No scrolling on long form');
    }

    return { score, reasons };
  }

  private async assessTransactionVelocity(
    tenantId: string,
    userId?: string,
    ipAddress?: string,
    amount?: number
  ): Promise<{ score: number; reasons: string[] }> {
    let score = 0;
    const reasons: string[] = [];

    try {
      const velocity = await this.getTransactionVelocity(tenantId, userId, ipAddress);

      // High frequency transactions
      if (velocity.last1Hour > 10) {
        score += 30;
        reasons.push('High transaction frequency (1 hour)');
      } else if (velocity.last1Hour > 5) {
        score += 20;
        reasons.push('Elevated transaction frequency (1 hour)');
      }

      if (velocity.last24Hours > 50) {
        score += 25;
        reasons.push('High transaction frequency (24 hours)');
      } else if (velocity.last24Hours > 20) {
        score += 15;
        reasons.push('Elevated transaction frequency (24 hours)');
      }

      // Amount significantly higher than average
      if (amount && velocity.averageAmount > 0) {
        const ratio = amount / velocity.averageAmount;
        if (ratio > 10) {
          score += 25;
          reasons.push('Amount significantly higher than average');
        } else if (ratio > 5) {
          score += 15;
          reasons.push('Amount higher than average');
        }
      }

      // Multiple cards used
      if (velocity.distinctCards > 5) {
        score += 20;
        reasons.push('Multiple payment methods used');
      }

      // Multiple IP addresses
      if (velocity.distinctIps > 10) {
        score += 15;
        reasons.push('Multiple IP addresses used');
      }

      return { score, reasons };
    } catch (error) {
      console.error('Transaction velocity assessment failed:', error);
      return { score: 0, reasons: [] };
    }
  }

  private async assessHistoricalRisk(
    tenantId: string,
    userId?: string,
    ipAddress?: string,
    customerId?: string
  ): Promise<{ score: number; reasons: string[] }> {
    let score = 0;
    const reasons: string[] = [];

    try {
      // Check for previous fraud attempts
      const fraudHistory = await this.getFraudHistory(tenantId, userId, ipAddress, customerId);

      if (fraudHistory.confirmedFraud > 0) {
        score += 50;
        reasons.push('Previous confirmed fraud');
      }

      if (fraudHistory.suspiciousActivity > 5) {
        score += 30;
        reasons.push('History of suspicious activity');
      } else if (fraudHistory.suspiciousActivity > 2) {
        score += 15;
        reasons.push('Some suspicious activity history');
      }

      if (fraudHistory.chargebacks > 0) {
        score += 25;
        reasons.push('Previous chargebacks');
      }

      if (fraudHistory.failedPayments > 10) {
        score += 20;
        reasons.push('High number of failed payments');
      }

      return { score, reasons };
    } catch (error) {
      console.error('Historical risk assessment failed:', error);
      return { score: 0, reasons: [] };
    }
  }

  private async applyCustomFraudRules(
    request: PaymentRequest,
    context: any
  ): Promise<{ score: number; reasons: string[] }> {
    let score = 0;
    const reasons: string[] = [];

    try {
      for (const rule of this.fraudRules) {
        if (!rule.isActive) continue;

        const ruleMatches = this.evaluateFraudRule(rule, request, context);
        if (ruleMatches) {
          score += rule.riskWeight;
          reasons.push(`Custom rule: ${rule.name}`);
        }
      }

      return { score, reasons };
    } catch (error) {
      console.error('Custom fraud rules evaluation failed:', error);
      return { score: 0, reasons: [] };
    }
  }

  private async getMachineLearningRiskScore(
    request: PaymentRequest,
    context: any
  ): Promise<{ score: number; reasons: string[] }> {
    try {
      // Placeholder for ML integration
      // In production, this would call an ML service or model

      // Simulate ML risk scoring based on various factors
      let mlScore = 0;
      const reasons: string[] = [];

      // Simple heuristic-based scoring as placeholder
      const features = {
        amount: request.amount,
        currency: request.currency,
        hasCustomerId: !!request.customerId,
        hasMetadata: !!request.metadata,
        ipRisk: context.geoLocation?.threatLevel === 'high' ? 1 : 0,
        deviceRisk: context.deviceFingerprint ? 0 : 1,
      };

      // Simulate ML model prediction
      const prediction = this.simulateMLPrediction(features);
      mlScore = prediction.riskScore;

      if (prediction.riskScore > 70) {
        reasons.push('ML model indicates high fraud risk');
      } else if (prediction.riskScore > 40) {
        reasons.push('ML model indicates moderate fraud risk');
      }

      return { score: mlScore, reasons };
    } catch (error) {
      console.error('ML risk scoring failed:', error);
      return { score: 0, reasons: [] };
    }
  }

  private determineRiskLevelAndRecommendation(riskScore: number): {
    riskLevel: 'low' | 'medium' | 'high';
    recommendation: 'approve' | 'review' | 'decline';
  } {
    if (riskScore < this.securityConfig.fraudThresholds.lowRisk) {
      return { riskLevel: 'low', recommendation: 'approve' };
    } else if (riskScore < this.securityConfig.fraudThresholds.mediumRisk) {
      return { riskLevel: 'medium', recommendation: 'review' };
    } else if (riskScore < this.securityConfig.fraudThresholds.highRisk) {
      return { riskLevel: 'high', recommendation: 'review' };
    } else {
      return { riskLevel: 'high', recommendation: 'decline' };
    }
  }

  // Helper methods (simplified implementations)
  private convertToUSD(amount: number, currency: string): number {
    // Simplified currency conversion - in production, use real exchange rates
    const rates: Record<string, number> = {
      USD: 1,
      EUR: 1.1,
      GBP: 1.3,
      JPY: 0.007,
      CAD: 0.75,
      AUD: 0.65,
    };
    return amount * (rates[currency] || 1);
  }

  private async isKnownDevice(
    deviceId: string,
    tenantId: string,
    userId?: string
  ): Promise<boolean> {
    // Check if device has been used before
    return false; // Placeholder
  }

  private detectDeviceSpoofing(fingerprint: DeviceFingerprint): boolean {
    // Detect inconsistencies in device fingerprint
    return false; // Placeholder
  }

  private detectAutomation(fingerprint: DeviceFingerprint): boolean {
    // Detect automation/bot indicators
    return false; // Placeholder
  }

  private async getDeviceReputation(deviceId: string): Promise<'good' | 'suspicious' | 'bad'> {
    // Check device reputation from threat intelligence
    return 'good'; // Placeholder
  }

  private async getTransactionVelocity(
    tenantId: string,
    userId?: string,
    ipAddress?: string
  ): Promise<TransactionVelocity> {
    // Get transaction velocity metrics
    return {
      last1Hour: 0,
      last24Hours: 0,
      last7Days: 0,
      last30Days: 0,
      averageAmount: 0,
      maxAmount: 0,
      distinctCards: 0,
      distinctIps: 0,
    };
  }

  private async getFraudHistory(
    tenantId: string,
    userId?: string,
    ipAddress?: string,
    customerId?: string
  ): Promise<{
    confirmedFraud: number;
    suspiciousActivity: number;
    chargebacks: number;
    failedPayments: number;
  }> {
    // Get fraud history
    return {
      confirmedFraud: 0,
      suspiciousActivity: 0,
      chargebacks: 0,
      failedPayments: 0,
    };
  }

  private validateFraudRule(rule: FraudRule): void {
    if (!rule.id || !rule.name || !rule.conditions) {
      throw new Error('Invalid fraud rule structure');
    }
  }

  private evaluateFraudRule(rule: FraudRule, request: PaymentRequest, context: any): boolean {
    // Evaluate if fraud rule conditions are met
    return false; // Placeholder
  }

  private simulateMLPrediction(features: any): { riskScore: number } {
    // Simulate ML model prediction
    let score = 0;

    if (features.amount > 10000) score += 20;
    if (features.ipRisk) score += 30;
    if (features.deviceRisk) score += 15;
    if (!features.hasCustomerId) score += 10;

    return { riskScore: Math.min(score, 100) };
  }

  private getDefaultSecurityConfig(): PaymentSecurityConfig {
    return {
      enableFraudDetection: true,
      fraudThresholds: {
        lowRisk: 20,
        mediumRisk: 50,
        highRisk: 80,
      },
      enableDeviceFingerprinting: true,
      enableIpGeolocation: true,
      enableBehaviorAnalysis: true,
      requireCvvCheck: true,
      requireAddressVerification: true,
      maxDailyTransactions: 100,
      maxDailyVolume: 100000,
      blockedCountries: ['AF', 'IQ', 'LY', 'SO', 'SY', 'YE'],
      allowedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
    };
  }

  private initializeFraudRules(): void {
    this.fraudRules = [
      {
        id: 'high_amount_new_customer',
        name: 'High Amount New Customer',
        description: 'High transaction amount from new customer',
        riskWeight: 25,
        isActive: true,
        conditions: [
          { field: 'amount', operator: 'greater_than', value: 5000, weight: 15 },
          { field: 'customerId', operator: 'equals', value: null, weight: 10 },
        ],
      },
      {
        id: 'multiple_failed_attempts',
        name: 'Multiple Failed Attempts',
        description: 'Multiple failed payment attempts in short time',
        riskWeight: 30,
        isActive: true,
        conditions: [{ field: 'failedAttempts', operator: 'greater_than', value: 3, weight: 30 }],
      },
    ];
  }
}
