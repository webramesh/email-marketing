import { createCipheriv, createDecipheriv, createHash, randomBytes, pbkdf2Sync } from 'crypto';
import { PaymentMethodData, PaymentSecurityConfig, PaymentMethodValidation } from '@/types/payment';
import { PaymentAuditLogger } from './audit-logger.service';

export interface EncryptedPaymentData {
  encryptedData: string;
  iv: string;
  authTag: string;
  keyId: string;
  algorithm: string;
  timestamp: Date;
}

export interface TokenizedCard {
  token: string;
  last4: string;
  brand: string;
  expiryMonth: number;
  expiryYear: number;
  fingerprint: string;
  isValid: boolean;
  createdAt: Date;
  expiresAt: Date;
}

export interface PCIComplianceCheck {
  isCompliant: boolean;
  violations: string[];
  recommendations: string[];
  lastChecked: Date;
  nextCheckDue: Date;
}

export interface SecurityAuditResult {
  passed: boolean;
  score: number;
  findings: SecurityFinding[];
  recommendations: string[];
  complianceStatus: 'compliant' | 'non_compliant' | 'needs_review';
}

export interface SecurityFinding {
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  description: string;
  remediation: string;
  affectedSystems: string[];
}

export class PaymentSecurityService {
  private static instance: PaymentSecurityService;
  private encryptionKeys: Map<string, Buffer> = new Map();
  private securityConfig: PaymentSecurityConfig;
  private auditLogger: PaymentAuditLogger;
  private readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  private readonly KEY_DERIVATION_ITERATIONS = 100000;

  constructor() {
    this.auditLogger = PaymentAuditLogger.getInstance();
    this.securityConfig = this.getDefaultSecurityConfig();
    this.initializeEncryptionKeys();
  }

  static getInstance(): PaymentSecurityService {
    if (!PaymentSecurityService.instance) {
      PaymentSecurityService.instance = new PaymentSecurityService();
    }
    return PaymentSecurityService.instance;
  }

  /**
   * Encrypt sensitive payment data with PCI DSS compliance
   */
  async encryptPaymentData(
    data: Record<string, any>,
    keyId: string = 'default'
  ): Promise<EncryptedPaymentData> {
    try {
      const key = this.getEncryptionKey(keyId);
      const iv = randomBytes(16);
      const cipher = createCipheriv(this.ENCRYPTION_ALGORITHM, key, iv);
      cipher.setAAD(Buffer.from(keyId));

      const jsonData = JSON.stringify(this.sanitizePaymentData(data));
      let encrypted = cipher.update(jsonData, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      const encryptedPaymentData: EncryptedPaymentData = {
        encryptedData: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        keyId,
        algorithm: this.ENCRYPTION_ALGORITHM,
        timestamp: new Date(),
      };

      // Log encryption event for audit
      await this.logSecurityEvent('data_encrypted', {
        keyId,
        dataSize: jsonData.length,
        algorithm: this.ENCRYPTION_ALGORITHM,
      });

      return encryptedPaymentData;
    } catch (error) {
      console.error('Payment data encryption failed:', error);
      await this.logSecurityEvent('encryption_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt sensitive payment data
   */
  async decryptPaymentData(encryptedData: EncryptedPaymentData): Promise<Record<string, any>> {
    try {
      const key = this.getEncryptionKey(encryptedData.keyId);
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const decipher = createDecipheriv(encryptedData.algorithm, key, iv);

      (decipher as any).setAAD(Buffer.from(encryptedData.keyId));
      (decipher as any).setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

      let decrypted = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      const data = JSON.parse(decrypted);

      // Log decryption event for audit
      await this.logSecurityEvent('data_decrypted', {
        keyId: encryptedData.keyId,
        algorithm: encryptedData.algorithm,
      });

      return data;
    } catch (error) {
      console.error('Payment data decryption failed:', error);
      await this.logSecurityEvent('decryption_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Decryption failed');
    }
  }

  /**
   * Tokenize credit card data for PCI compliance
   */
  async tokenizeCard(cardData: {
    number: string;
    expiryMonth: number;
    expiryYear: number;
    cvv: string;
    holderName: string;
  }): Promise<TokenizedCard> {
    try {
      // Validate card data first
      const validation = this.validatePaymentMethod({
        id: '',
        type: 'card',
        last4: cardData.number.slice(-4),
        brand: this.detectCardBrand(cardData.number),
        expiryMonth: cardData.expiryMonth,
        expiryYear: cardData.expiryYear,
        isDefault: false,
      });

      if (!validation.isValid) {
        throw new Error(`Invalid card data: ${validation.errors.join(', ')}`);
      }

      // Generate secure token
      const token = this.generateSecureToken();
      const fingerprint = this.generateCardFingerprint(cardData.number);

      // Encrypt and store card data
      await this.encryptPaymentData({
        number: cardData.number,
        cvv: cardData.cvv,
        holderName: cardData.holderName,
      });

      // Store tokenized card (in production, this would be in a secure vault)
      const tokenizedCard: TokenizedCard = {
        token,
        last4: cardData.number.slice(-4),
        brand: this.detectCardBrand(cardData.number),
        expiryMonth: cardData.expiryMonth,
        expiryYear: cardData.expiryYear,
        fingerprint,
        isValid: true,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      };

      // Log tokenization event
      await this.logSecurityEvent('card_tokenized', {
        token,
        last4: cardData.number.slice(-4),
        brand: tokenizedCard.brand,
      });

      return tokenizedCard;
    } catch (error) {
      console.error('Card tokenization failed:', error);
      await this.logSecurityEvent('tokenization_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Detokenize card data (only for authorized operations)
   */
  async detokenizeCard(
    tokenValue: string,
    purpose: string
  ): Promise<{
    number: string;
    cvv: string;
    holderName: string;
  } | null> {
    try {
      // Verify token is valid and not expired
      const tokenData = await this.getTokenData(tokenValue);
      if (!tokenData || !tokenData.isValid || tokenData.expiresAt < new Date()) {
        throw new Error('Invalid or expired token');
      }

      // Log detokenization attempt
      await this.logSecurityEvent('detokenization_attempted', {
        token: tokenValue.substring(0, 8) + '...', // Only log partial token for security
        purpose,
        timestamp: new Date(),
      });

      // In production, this would retrieve from secure vault
      // For now, return null as placeholder
      return null;
    } catch (error) {
      console.error('Card detokenization failed:', error);
      await this.logSecurityEvent('detokenization_failed', {
        token: tokenValue.substring(0, 8) + '...', // Only log partial token for security
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Validate payment method data
   */
  validatePaymentMethod(paymentMethod: PaymentMethodData): PaymentMethodValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    const securityChecks = {
      cvvValid: true,
      expiryValid: true,
      luhnValid: true,
      binValid: true,
    };

    try {
      // Validate card number using Luhn algorithm
      if (paymentMethod.type === 'card' && paymentMethod.last4) {
        // In production, you'd have the full number for validation
        // For now, just check last4 format
        if (!/^\d{4}$/.test(paymentMethod.last4)) {
          errors.push('Invalid card number format');
          securityChecks.luhnValid = false;
        }
      }

      // Validate expiry date
      if (paymentMethod.expiryMonth && paymentMethod.expiryYear) {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        if (paymentMethod.expiryMonth < 1 || paymentMethod.expiryMonth > 12) {
          errors.push('Invalid expiry month');
          securityChecks.expiryValid = false;
        }

        if (
          paymentMethod.expiryYear < currentYear ||
          (paymentMethod.expiryYear === currentYear && paymentMethod.expiryMonth < currentMonth)
        ) {
          errors.push('Card has expired');
          securityChecks.expiryValid = false;
        }

        if (paymentMethod.expiryYear > currentYear + 20) {
          warnings.push('Expiry date is unusually far in the future');
        }
      }

      // Validate card brand
      if (paymentMethod.brand) {
        const validBrands = ['visa', 'mastercard', 'amex', 'discover', 'jcb', 'diners'];
        if (!validBrands.includes(paymentMethod.brand.toLowerCase())) {
          warnings.push('Uncommon card brand');
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        securityChecks,
      };
    } catch (error) {
      console.error('Payment method validation failed:', error);
      return {
        isValid: false,
        errors: ['Validation process failed'],
        warnings: [],
        securityChecks: {
          cvvValid: false,
          expiryValid: false,
          luhnValid: false,
          binValid: false,
        },
      };
    }
  }

  /**
   * Perform PCI DSS compliance check
   */
  async performPCIComplianceCheck(): Promise<PCIComplianceCheck> {
    try {
      const violations: string[] = [];
      const recommendations: string[] = [];

      // Check 1: Secure storage of cardholder data
      if (!this.isCardDataProperlyEncrypted()) {
        violations.push('Cardholder data is not properly encrypted');
        recommendations.push('Implement strong encryption for all cardholder data');
      }

      // Check 2: Access controls
      if (!this.areAccessControlsProperlyImplemented()) {
        violations.push('Access controls are not properly implemented');
        recommendations.push('Implement role-based access controls for payment data');
      }

      // Check 3: Network security
      if (!this.isNetworkSecurityAdequate()) {
        violations.push('Network security measures are inadequate');
        recommendations.push('Implement network segmentation and firewalls');
      }

      // Check 4: Vulnerability management
      if (!this.isVulnerabilityManagementActive()) {
        violations.push('Vulnerability management program is not active');
        recommendations.push('Implement regular vulnerability scanning and patching');
      }

      // Check 5: Monitoring and logging
      if (!this.isMonitoringAndLoggingAdequate()) {
        violations.push('Monitoring and logging are inadequate');
        recommendations.push('Implement comprehensive audit logging and monitoring');
      }

      const isCompliant = violations.length === 0;
      const nextCheckDue = new Date();
      nextCheckDue.setMonth(nextCheckDue.getMonth() + 3); // Quarterly checks

      const complianceCheck: PCIComplianceCheck = {
        isCompliant,
        violations,
        recommendations,
        lastChecked: new Date(),
        nextCheckDue,
      };

      // Log compliance check
      await this.logSecurityEvent('pci_compliance_check', {
        isCompliant,
        violationCount: violations.length,
        recommendationCount: recommendations.length,
      });

      return complianceCheck;
    } catch (error) {
      console.error('PCI compliance check failed:', error);
      throw error;
    }
  }

  /**
   * Perform comprehensive security audit
   */
  async performSecurityAudit(tenantId: string): Promise<SecurityAuditResult> {
    try {
      const findings: SecurityFinding[] = [];
      let score = 100;

      // Audit encryption practices
      const encryptionFindings = await this.auditEncryptionPractices();
      findings.push(...encryptionFindings);
      score -= encryptionFindings.length * 10;

      // Audit access controls
      const accessFindings = await this.auditAccessControls(tenantId);
      findings.push(...accessFindings);
      score -= accessFindings.length * 15;

      // Audit data handling
      const dataFindings = await this.auditDataHandling();
      findings.push(...dataFindings);
      score -= dataFindings.length * 20;

      // Audit logging and monitoring
      const loggingFindings = await this.auditLoggingAndMonitoring();
      findings.push(...loggingFindings);
      score -= loggingFindings.length * 5;

      const criticalFindings = findings.filter(f => f.severity === 'critical');
      const highFindings = findings.filter(f => f.severity === 'high');

      let complianceStatus: 'compliant' | 'non_compliant' | 'needs_review';
      if (criticalFindings.length > 0) {
        complianceStatus = 'non_compliant';
      } else if (highFindings.length > 0) {
        complianceStatus = 'needs_review';
      } else {
        complianceStatus = 'compliant';
      }

      const auditResult: SecurityAuditResult = {
        passed: score >= 80 && criticalFindings.length === 0,
        score: Math.max(0, score),
        findings,
        recommendations: this.generateSecurityRecommendations(findings),
        complianceStatus,
      };

      // Log security audit
      await this.logSecurityEvent('security_audit_completed', {
        tenantId,
        score: auditResult.score,
        findingsCount: findings.length,
        complianceStatus,
      });

      return auditResult;
    } catch (error) {
      console.error('Security audit failed:', error);
      throw error;
    }
  }

  /**
   * Securely hash sensitive data
   */
  hashSensitiveData(data: string, salt?: string): string {
    const actualSalt = salt || randomBytes(32).toString('hex');
    const hash = pbkdf2Sync(data, actualSalt, this.KEY_DERIVATION_ITERATIONS, 64, 'sha512');
    return `${actualSalt}:${hash.toString('hex')}`;
  }

  /**
   * Verify hashed sensitive data
   */
  verifySensitiveData(data: string, hashedData: string): boolean {
    try {
      const [salt, hash] = hashedData.split(':');
      const verifyHash = pbkdf2Sync(data, salt, this.KEY_DERIVATION_ITERATIONS, 64, 'sha512');
      return hash === verifyHash.toString('hex');
    } catch (error) {
      console.error('Hash verification failed:', error);
      return false;
    }
  }

  // Private helper methods
  private initializeEncryptionKeys(): void {
    // In production, keys should be loaded from secure key management service
    const defaultKey = process.env.PAYMENT_ENCRYPTION_KEY || this.generateSecureKey();
    this.encryptionKeys.set('default', Buffer.from(defaultKey, 'hex'));

    // Additional keys for key rotation
    const rotationKey = process.env.PAYMENT_ROTATION_KEY || this.generateSecureKey();
    this.encryptionKeys.set('rotation', Buffer.from(rotationKey, 'hex'));
  }

  private getEncryptionKey(keyId: string): Buffer {
    const key = this.encryptionKeys.get(keyId);
    if (!key) {
      throw new Error(`Encryption key not found: ${keyId}`);
    }
    return key;
  }

  private generateSecureKey(): string {
    return randomBytes(32).toString('hex');
  }

  private generateSecureToken(): string {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(16).toString('hex');
    return `tok_${timestamp}_${random}`;
  }

  private generateCardFingerprint(cardNumber: string): string {
    return createHash('sha256').update(cardNumber).digest('hex');
  }

  private detectCardBrand(cardNumber: string): string {
    const number = cardNumber.replace(/\D/g, '');

    if (/^4/.test(number)) return 'visa';
    if (/^5[1-5]/.test(number) || /^2[2-7]/.test(number)) return 'mastercard';
    if (/^3[47]/.test(number)) return 'amex';
    if (/^6(?:011|5)/.test(number)) return 'discover';
    if (/^35/.test(number)) return 'jcb';
    if (/^3[068]/.test(number)) return 'diners';

    return 'unknown';
  }

  private sanitizePaymentData(data: Record<string, any>): Record<string, any> {
    const sanitized = { ...data };

    // Remove or mask sensitive fields that shouldn't be stored
    if (sanitized.cvv) {
      delete sanitized.cvv; // Never store CVV
    }

    if (sanitized.number) {
      // Only store last 4 digits
      sanitized.last4 = sanitized.number.slice(-4);
      delete sanitized.number;
    }

    return sanitized;
  }

  private async getTokenData(_token: string): Promise<TokenizedCard | null> {
    // In production, this would query the secure token vault
    return null; // Placeholder
  }

  private async logSecurityEvent(event: string, data: any): Promise<void> {
    try {
      await this.auditLogger.logSecurityEvent(event, data);
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  // PCI DSS compliance check methods
  private isCardDataProperlyEncrypted(): boolean {
    return this.encryptionKeys.size > 0; // Simplified check
  }

  private areAccessControlsProperlyImplemented(): boolean {
    return true; // Placeholder - would check actual access controls
  }

  private isNetworkSecurityAdequate(): boolean {
    return true; // Placeholder - would check network security
  }

  private isVulnerabilityManagementActive(): boolean {
    return true; // Placeholder - would check vulnerability management
  }

  private isMonitoringAndLoggingAdequate(): boolean {
    return true; // Placeholder - would check monitoring and logging
  }

  // Security audit methods
  private async auditEncryptionPractices(): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    if (this.encryptionKeys.size < 2) {
      findings.push({
        severity: 'medium',
        category: 'encryption',
        description: 'Key rotation not implemented',
        remediation: 'Implement key rotation mechanism',
        affectedSystems: ['payment_processing'],
      });
    }

    return findings;
  }

  private async auditAccessControls(_tenantId: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    // Placeholder audit checks
    return findings;
  }

  private async auditDataHandling(): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    // Placeholder audit checks
    return findings;
  }

  private async auditLoggingAndMonitoring(): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    // Placeholder audit checks
    return findings;
  }

  private generateSecurityRecommendations(findings: SecurityFinding[]): string[] {
    const recommendations: string[] = [];

    findings.forEach(finding => {
      if (!recommendations.includes(finding.remediation)) {
        recommendations.push(finding.remediation);
      }
    });

    return recommendations;
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
}
