import { createHash, createHmac, randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import {
  PaymentAuditType,
  PaymentProviderType,
} from '@/types/payment';

export interface AuditLogEntry {
  tenantId: string;
  userId?: string;
  type: PaymentAuditType;
  provider: PaymentProviderType;
  paymentId?: string;
  customerId?: string;
  subscriptionId?: string;
  amount?: number;
  currency?: string;
  status: string;
  fraudScore?: number;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  sensitiveData?: Record<string, any>; // Will be encrypted
}

export interface ImmutableAuditRecord {
  id: string;
  tenantId: string;
  userId?: string;
  type: PaymentAuditType;
  provider: PaymentProviderType;
  paymentId?: string;
  customerId?: string;
  subscriptionId?: string;
  amount?: number;
  currency?: string;
  status: string;
  fraudScore?: number;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  encryptedData?: string; // Encrypted sensitive data
  immutableHash: string;
  previousHash?: string; // Chain of custody
  blockNumber: number; // Sequential block number for integrity
  createdAt: Date;
  signature: string; // Digital signature for authenticity
}

export class PaymentAuditLogger {
  private static instance: PaymentAuditLogger;
  private readonly encryptionKey: Buffer;
  private readonly signingKey: Buffer;
  private readonly hmacSecret: string;

  constructor() {
    // In production, these should come from secure key management
    this.encryptionKey = Buffer.from(
      process.env.PAYMENT_ENCRYPTION_KEY || this.generateSecureKey(),
      'hex'
    );
    this.signingKey = Buffer.from(
      process.env.PAYMENT_SIGNING_KEY || this.generateSecureKey(),
      'hex'
    );
    this.hmacSecret = process.env.PAYMENT_HMAC_SECRET || this.generateSecureKey();
  }

  static getInstance(): PaymentAuditLogger {
    if (!PaymentAuditLogger.instance) {
      PaymentAuditLogger.instance = new PaymentAuditLogger();
    }
    return PaymentAuditLogger.instance;
  }

  private generateSecureKey(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Log a payment audit event with immutable record creation
   */
  async logPaymentEvent(entry: AuditLogEntry): Promise<ImmutableAuditRecord> {
    try {
      // Get the last block number for chain integrity
      const lastRecord = await this.getLastAuditRecord(entry.tenantId);
      const blockNumber = (lastRecord?.blockNumber || 0) + 1;
      const previousHash = lastRecord?.immutableHash;

      // Encrypt sensitive data
      const encryptedData = entry.sensitiveData
        ? await this.encryptSensitiveData(entry.sensitiveData)
        : undefined;

      // Create the audit record
      const auditRecord: Omit<ImmutableAuditRecord, 'id' | 'signature'> = {
        tenantId: entry.tenantId,
        userId: entry.userId,
        type: entry.type,
        provider: entry.provider,
        paymentId: entry.paymentId,
        customerId: entry.customerId,
        subscriptionId: entry.subscriptionId,
        amount: entry.amount,
        currency: entry.currency,
        status: entry.status,
        fraudScore: entry.fraudScore,
        ipAddress: this.maskIpAddress(entry.ipAddress),
        userAgent: this.sanitizeUserAgent(entry.userAgent),
        metadata: this.sanitizeMetadata(entry.metadata),
        encryptedData,
        immutableHash: '', // Will be calculated
        previousHash,
        blockNumber,
        createdAt: new Date(),
      };

      // Generate immutable hash
      const immutableHash = this.generateImmutableHash(auditRecord);
      auditRecord.immutableHash = immutableHash;

      // Generate digital signature
      const signature = this.generateDigitalSignature(auditRecord);

      // Create the final record
      const finalRecord: ImmutableAuditRecord = {
        id: this.generateAuditId(),
        ...auditRecord,
        signature,
      };

      // Store in database with additional security measures
      await this.storeAuditRecord(finalRecord);

      // Log to security monitoring for high-risk events
      if (this.isHighRiskEvent(entry)) {
        await this.logToSecurityMonitoring(finalRecord);
      }

      return finalRecord;
    } catch (error) {
      console.error('Failed to log payment audit event:', error);
      // Create emergency log entry
      await this.createEmergencyLog(entry, error);
      throw error;
    }
  }

  /**
   * Verify the integrity of an audit record
   */
  async verifyAuditRecord(recordId: string): Promise<{
    isValid: boolean;
    errors: string[];
    record?: ImmutableAuditRecord;
  }> {
    try {
      const record = await this.getAuditRecord(recordId);
      if (!record) {
        return { isValid: false, errors: ['Record not found'] };
      }

      const errors: string[] = [];

      // Verify immutable hash
      const expectedHash = this.generateImmutableHash(record);
      if (record.immutableHash !== expectedHash) {
        errors.push('Immutable hash verification failed');
      }

      // Verify digital signature
      const isSignatureValid = this.verifyDigitalSignature(record);
      if (!isSignatureValid) {
        errors.push('Digital signature verification failed');
      }

      // Verify chain integrity if not the first record
      if (record.previousHash) {
        const previousRecord = await this.getPreviousAuditRecord(record);
        if (!previousRecord || previousRecord.immutableHash !== record.previousHash) {
          errors.push('Chain integrity verification failed');
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        record,
      };
    } catch (error) {
      console.error('Failed to verify audit record:', error);
      return { isValid: false, errors: ['Verification process failed'] };
    }
  }

  /**
   * Get audit trail for a specific payment or customer
   */
  async getAuditTrail(filters: {
    tenantId: string;
    paymentId?: string;
    customerId?: string;
    subscriptionId?: string;
    userId?: string;
    type?: PaymentAuditType;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<ImmutableAuditRecord[]> {
    try {
      const whereClause: any = {
        tenantId: filters.tenantId,
        resource: 'payment',
      };

      if (filters.paymentId) {
        whereClause.resourceId = filters.paymentId;
      }
      if (filters.userId) {
        whereClause.userId = filters.userId;
      }
      if (filters.type) {
        whereClause.action = filters.type;
      }
      if (filters.startDate || filters.endDate) {
        whereClause.createdAt = {};
        if (filters.startDate) {
          whereClause.createdAt.gte = filters.startDate;
        }
        if (filters.endDate) {
          whereClause.createdAt.lte = filters.endDate;
        }
      }

      const records = await prisma.auditLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 100,
      });

      return records.map(record => this.convertToImmutableRecord(record));
    } catch (error) {
      console.error('Failed to get audit trail:', error);
      throw error;
    }
  }

  /**
   * Generate compliance report for audit purposes
   */
  async generateComplianceReport(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalTransactions: number;
    fraudDetected: number;
    failedTransactions: number;
    complianceViolations: string[];
    integrityStatus: 'valid' | 'compromised';
    reportHash: string;
  }> {
    try {
      // This would generate a comprehensive compliance report
      // For now, return placeholder data
      return {
        totalTransactions: 0,
        fraudDetected: 0,
        failedTransactions: 0,
        complianceViolations: [],
        integrityStatus: 'valid',
        reportHash: this.generateSecureKey(),
      };
    } catch (error) {
      console.error('Failed to generate compliance report:', error);
      throw error;
    }
  }

  private async encryptSensitiveData(data: Record<string, any>): Promise<string> {
    try {
      const cipher = require('crypto').createCipher('aes-256-gcm', this.encryptionKey);
      const jsonData = JSON.stringify(data);
      let encrypted = cipher.update(jsonData, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();

      return JSON.stringify({
        encrypted,
        authTag: authTag.toString('hex'),
        algorithm: 'aes-256-gcm',
      });
    } catch (error) {
      console.error('Failed to encrypt sensitive data:', error);
      throw new Error('Encryption failed');
    }
  }

  private async decryptSensitiveData(encryptedData: string): Promise<Record<string, any>> {
    try {
      const { encrypted, authTag, algorithm } = JSON.parse(encryptedData);
      const decipher = require('crypto').createDecipher(algorithm, this.encryptionKey);
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Failed to decrypt sensitive data:', error);
      throw new Error('Decryption failed');
    }
  }

  private generateImmutableHash(record: Omit<ImmutableAuditRecord, 'id' | 'signature'>): string {
    const hashData = {
      tenantId: record.tenantId,
      userId: record.userId,
      type: record.type,
      provider: record.provider,
      paymentId: record.paymentId,
      customerId: record.customerId,
      subscriptionId: record.subscriptionId,
      amount: record.amount,
      currency: record.currency,
      status: record.status,
      fraudScore: record.fraudScore,
      blockNumber: record.blockNumber,
      previousHash: record.previousHash,
      createdAt: record.createdAt.toISOString(),
    };

    const sortedData = JSON.stringify(hashData, Object.keys(hashData).sort());
    return createHash('sha256').update(sortedData).digest('hex');
  }

  private generateDigitalSignature(record: Omit<ImmutableAuditRecord, 'id' | 'signature'>): string {
    const signatureData = `${record.immutableHash}:${
      record.tenantId
    }:${record.createdAt.toISOString()}`;
    return createHmac('sha256', this.signingKey).update(signatureData).digest('hex');
  }

  private verifyDigitalSignature(record: ImmutableAuditRecord): boolean {
    const expectedSignature = this.generateDigitalSignature(record);
    return record.signature === expectedSignature;
  }

  private generateAuditId(): string {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(8).toString('hex');
    return `audit_${timestamp}_${random}`;
  }

  private maskIpAddress(ipAddress?: string): string | undefined {
    if (!ipAddress) return undefined;

    // Mask the last octet for IPv4 or last 64 bits for IPv6
    if (ipAddress.includes('.')) {
      const parts = ipAddress.split('.');
      return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
    } else if (ipAddress.includes(':')) {
      const parts = ipAddress.split(':');
      return `${parts.slice(0, 4).join(':')}:xxxx:xxxx:xxxx:xxxx`;
    }

    return 'xxx.xxx.xxx.xxx';
  }

  private sanitizeUserAgent(userAgent?: string): string | undefined {
    if (!userAgent) return undefined;

    // Remove potentially sensitive information from user agent
    return userAgent
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, 'xxx.xxx.xxx.xxx')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[email]')
      .substring(0, 500); // Limit length
  }

  private sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> | undefined {
    if (!metadata) return undefined;

    const sanitized = { ...metadata };

    // Remove sensitive fields
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'cvv',
      'ssn',
      'creditCard',
      'bankAccount',
      'pin',
      'otp',
    ];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private isHighRiskEvent(entry: AuditLogEntry): boolean {
    return (
      (entry.fraudScore !== undefined && entry.fraudScore > 70) ||
      entry.type === PaymentAuditType.FRAUD_DETECTED ||
      entry.status === 'failed' ||
      (entry.amount !== undefined && entry.amount > 10000)
    );
  }

  private async logToSecurityMonitoring(record: ImmutableAuditRecord): Promise<void> {
    try {
      console.warn('HIGH_RISK_PAYMENT_AUDIT:', {
        id: record.id,
        tenantId: record.tenantId,
        type: record.type,
        amount: record.amount,
        fraudScore: record.fraudScore,
        timestamp: record.createdAt.toISOString(),
      });

      // In production, this would send to security monitoring system
      // like Splunk, DataDog, or custom SIEM
    } catch (error) {
      console.error('Failed to log to security monitoring:', error);
    }
  }

  private async createEmergencyLog(entry: AuditLogEntry, error: any): Promise<void> {
    try {
      console.error('PAYMENT_AUDIT_EMERGENCY_LOG:', {
        tenantId: entry.tenantId,
        type: entry.type,
        error: error.message,
        timestamp: new Date().toISOString(),
        originalEntry: this.sanitizeMetadata(entry.metadata),
      });
    } catch (emergencyError) {
      console.error('Failed to create emergency log:', emergencyError);
    }
  }

  private async storeAuditRecord(record: ImmutableAuditRecord): Promise<void> {
    try {
      // In production, this would store in a secure, append-only database
      // For now, we'll use structured logging and the existing audit log table

      await prisma.auditLog.create({
        data: {
          id: record.id,
          tenantId: record.tenantId,
          action: record.type,
          resource: 'payment',
          resourceId: record.paymentId || record.customerId || record.subscriptionId,
          userId: record.userId,
          ipAddress: record.ipAddress,
          userAgent: record.userAgent,
          changes: record.metadata,
          metadata: {
            provider: record.provider,
            amount: record.amount,
            currency: record.currency,
            status: record.status,
            fraudScore: record.fraudScore,
            immutableHash: record.immutableHash,
            previousHash: record.previousHash,
            blockNumber: record.blockNumber,
            signature: record.signature,
            encryptedData: record.encryptedData,
          },
          createdAt: record.createdAt,
        },
      });

      console.log('PAYMENT_AUDIT_STORED:', {
        id: record.id,
        tenantId: record.tenantId,
        type: record.type,
        blockNumber: record.blockNumber,
        hash: record.immutableHash,
      });
    } catch (error) {
      console.error('Failed to store audit record:', error);
      throw error;
    }
  }

  private async getLastAuditRecord(tenantId: string): Promise<ImmutableAuditRecord | null> {
    try {
      const lastRecord = await prisma.auditLog.findFirst({
        where: {
          tenantId,
          resource: 'payment',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!lastRecord || !lastRecord.metadata) return null;

      const metadata = lastRecord.metadata as any;
      return {
        id: lastRecord.id,
        tenantId: lastRecord.tenantId,
        userId: lastRecord.userId || undefined,
        type: lastRecord.action as PaymentAuditType,
        provider: metadata.provider,
        paymentId: lastRecord.resourceId || undefined,
        customerId: undefined,
        subscriptionId: undefined,
        amount: metadata.amount,
        currency: metadata.currency,
        status: metadata.status,
        fraudScore: metadata.fraudScore,
        ipAddress: lastRecord.ipAddress || undefined,
        userAgent: lastRecord.userAgent || undefined,
        metadata: lastRecord.changes as Record<string, any>,
        encryptedData: metadata.encryptedData,
        immutableHash: metadata.immutableHash,
        previousHash: metadata.previousHash,
        blockNumber: metadata.blockNumber,
        createdAt: lastRecord.createdAt,
        signature: metadata.signature,
      };
    } catch (error) {
      console.error('Failed to get last audit record:', error);
      return null;
    }
  }

  private async getAuditRecord(recordId: string): Promise<ImmutableAuditRecord | null> {
    try {
      const record = await prisma.auditLog.findUnique({
        where: { id: recordId },
      });

      if (!record || !record.metadata) return null;

      const metadata = record.metadata as any;
      return {
        id: record.id,
        tenantId: record.tenantId,
        userId: record.userId || undefined,
        type: record.action as PaymentAuditType,
        provider: metadata.provider,
        paymentId: record.resourceId || undefined,
        customerId: undefined,
        subscriptionId: undefined,
        amount: metadata.amount,
        currency: metadata.currency,
        status: metadata.status,
        fraudScore: metadata.fraudScore,
        ipAddress: record.ipAddress || undefined,
        userAgent: record.userAgent || undefined,
        metadata: record.changes as Record<string, any>,
        encryptedData: metadata.encryptedData,
        immutableHash: metadata.immutableHash,
        previousHash: metadata.previousHash,
        blockNumber: metadata.blockNumber,
        createdAt: record.createdAt,
        signature: metadata.signature,
      };
    } catch (error) {
      console.error('Failed to get audit record:', error);
      return null;
    }
  }

  private async getPreviousAuditRecord(
    record: ImmutableAuditRecord
  ): Promise<ImmutableAuditRecord | null> {
    try {
      const previousRecord = await prisma.auditLog.findFirst({
        where: {
          tenantId: record.tenantId,
          resource: 'payment',
          createdAt: {
            lt: record.createdAt,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!previousRecord || !previousRecord.metadata) return null;

      return this.convertToImmutableRecord(previousRecord);
    } catch (error) {
      console.error('Failed to get previous audit record:', error);
      return null;
    }
  }

  private convertToImmutableRecord(record: any): ImmutableAuditRecord {
    const metadata = record.metadata as any;
    return {
      id: record.id,
      tenantId: record.tenantId,
      userId: record.userId || undefined,
      type: record.action as PaymentAuditType,
      provider: metadata?.provider || PaymentProviderType.STRIPE,
      paymentId: record.resourceId || undefined,
      customerId: undefined,
      subscriptionId: undefined,
      amount: metadata?.amount,
      currency: metadata?.currency,
      status: metadata?.status || 'unknown',
      fraudScore: metadata?.fraudScore,
      ipAddress: record.ipAddress || undefined,
      userAgent: record.userAgent || undefined,
      metadata: record.changes as Record<string, any>,
      encryptedData: metadata?.encryptedData,
      immutableHash: metadata?.immutableHash || '',
      previousHash: metadata?.previousHash,
      blockNumber: metadata?.blockNumber || 0,
      createdAt: record.createdAt,
      signature: metadata?.signature || '',
    };
  }

  /**
   * Log a transaction event (used by payment service)
   */
  async logTransaction(data: {
    type: string;
    provider: PaymentProviderType;
    request?: any;
    result?: any;
    error?: any;
    tenantId?: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      const auditType = this.mapTransactionTypeToAuditType(data.type);
      
      await this.logPaymentEvent({
        tenantId: data.tenantId || 'unknown',
        userId: data.userId,
        type: auditType,
        provider: data.provider,
        status: data.error ? 'error' : 'success',
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: {
          transactionType: data.type,
          request: data.request,
          result: data.result,
          error: data.error?.message,
        },
      });
    } catch (error) {
      console.error('Failed to log transaction:', error);
    }
  }

  /**
   * Log a security event (used by security service)
   */
  async logSecurityEvent(event: string, data: any, context?: {
    tenantId?: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      console.log('PAYMENT_SECURITY_EVENT:', {
        event,
        data,
        timestamp: new Date().toISOString(),
        context,
      });

      // Also log to audit trail for security events
      if (context?.tenantId) {
        await this.logPaymentEvent({
          tenantId: context.tenantId,
          userId: context.userId,
          type: PaymentAuditType.SECURITY_EVENT,
          provider: PaymentProviderType.STRIPE, // Default provider
          status: data.error ? 'failed' : 'success',
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          metadata: {
            securityEvent: event,
            eventData: data,
          },
        });
      }
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  private mapTransactionTypeToAuditType(type: string): PaymentAuditType {
    switch (type) {
      case 'payment_method_addition':
        return PaymentAuditType.PAYMENT_METHOD_ADDED;
      case 'payment_method_removal':
        return PaymentAuditType.PAYMENT_METHOD_REMOVED;
      case 'default_payment_method_update':
        return PaymentAuditType.PAYMENT_METHOD_UPDATED;
      default:
        return PaymentAuditType.PAYMENT_CREATED;
    }
  }
}
