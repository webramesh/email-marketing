import { PrismaClient } from '@/generated/prisma';
import {
  EmailValidationResult,
  VerificationStatus,
  EmailVerification,
  BulkVerificationJob,
} from '@/types';
import validator from 'validator';
import { promisify } from 'util';
import { lookup } from 'dns';

const dnsLookup = promisify(lookup);

/**
 * Email Verification Service
 * Handles real-time email validation and bulk verification operations
 */
export class EmailVerificationService {
  private prisma: PrismaClient;
  private cache: Map<string, EmailValidationResult> = new Map();
  private jobCache: Map<string, BulkVerificationJob> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  // Common disposable email domains
  private readonly DISPOSABLE_DOMAINS = new Set([
    '10minutemail.com',
    'guerrillamail.com',
    'mailinator.com',
    'tempmail.org',
    'yopmail.com',
    'temp-mail.org',
    'throwaway.email',
    'maildrop.cc',
  ]);

  // Common role-based email prefixes
  private readonly ROLE_PREFIXES = new Set([
    'admin',
    'administrator',
    'support',
    'help',
    'info',
    'contact',
    'sales',
    'marketing',
    'noreply',
    'no-reply',
    'postmaster',
    'webmaster',
    'abuse',
  ]);

  // Free email providers
  private readonly FREE_PROVIDERS = new Set([
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'aol.com',
    'icloud.com',
    'protonmail.com',
    'mail.com',
    'yandex.com',
  ]);

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Validate a single email address with comprehensive checks
   */
  async validateEmail(
    email: string,
    tenantId: string,
    useCache = true
  ): Promise<EmailValidationResult> {
    const normalizedEmail = email.toLowerCase().trim();

    // Check cache first
    if (useCache && this.isInCache(normalizedEmail)) {
      return this.cache.get(normalizedEmail)!;
    }

    const result = await this.performValidation(normalizedEmail);

    // Cache the result
    if (useCache) {
      this.cache.set(normalizedEmail, result);
      this.cacheExpiry.set(normalizedEmail, Date.now() + this.CACHE_TTL);
    }

    // Store in database
    await this.storeVerificationResult(normalizedEmail, result, tenantId);

    return result;
  }

  /**
   * Perform comprehensive email validation
   */
  private async performValidation(email: string): Promise<EmailValidationResult> {
    const result: EmailValidationResult = {
      email,
      isValid: false,
      status: VerificationStatus.INVALID,
      details: {
        syntax: false,
        domain: false,
        mailbox: false,
        disposable: false,
        role: false,
        free: false,
        mx: false,
        smtp: false,
      },
    };

    try {
      // 1. Syntax validation
      result.details.syntax = validator.isEmail(email, {
        allow_utf8_local_part: false,
        require_tld: true,
        allow_ip_domain: false,
        domain_specific_validation: true,
      });

      if (!result.details.syntax) {
        result.reason = 'Invalid email syntax';
        return result;
      }

      const [localPart, domain] = email.split('@');

      // 2. Domain validation
      result.details.domain = await this.validateDomain(domain);
      if (!result.details.domain) {
        result.reason = 'Invalid or non-existent domain';
        return result;
      }

      // 3. Check for disposable email
      result.details.disposable = this.DISPOSABLE_DOMAINS.has(domain);

      // 4. Check for role-based email
      result.details.role = this.ROLE_PREFIXES.has(localPart.toLowerCase());

      // 5. Check for free email provider
      result.details.free = this.FREE_PROVIDERS.has(domain);

      // 6. MX record validation
      result.details.mx = await this.checkMXRecord(domain);

      // 7. SMTP validation (basic check)
      result.details.smtp = await this.validateSMTP(email, domain);

      // 8. Mailbox validation (if SMTP check passed)
      if (result.details.smtp) {
        result.details.mailbox = await this.validateMailbox(email, domain);
      }

      // Determine overall status and validity
      this.determineValidationStatus(result);
    } catch (error) {
      console.error('Email validation error:', error);
      result.status = VerificationStatus.UNKNOWN;
      result.reason = 'Validation service temporarily unavailable';
    }

    return result;
  }

  /**
   * Validate domain existence and basic checks
   */
  private async validateDomain(domain: string): Promise<boolean> {
    try {
      // Basic domain format check - simplified for better compatibility
      if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
        return false;
      }

      // Check if domain resolves
      await dnsLookup(domain);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check MX record for domain
   */
  private async checkMXRecord(domain: string): Promise<boolean> {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      const { stdout } = await execAsync(`nslookup -type=MX ${domain}`);
      return stdout.includes('mail exchanger');
    } catch {
      return false;
    }
  }

  /**
   * Basic SMTP validation
   */
  private async validateSMTP(_email: string, domain: string): Promise<boolean> {
    try {
      // This is a simplified SMTP check
      // In production, you might want to use a more robust SMTP validation library
      const net = require('net');

      return new Promise(resolve => {
        const socket = net.createConnection(25, domain);

        socket.setTimeout(5000);

        socket.on('connect', () => {
          socket.destroy();
          resolve(true);
        });

        socket.on('error', () => {
          resolve(false);
        });

        socket.on('timeout', () => {
          socket.destroy();
          resolve(false);
        });
      });
    } catch {
      return false;
    }
  }

  /**
   * Validate mailbox existence (simplified)
   */
  private async validateMailbox(_email: string, _domain: string): Promise<boolean> {
    // This is a placeholder for mailbox validation
    // In production, you would implement SMTP RCPT TO validation
    // or integrate with a third-party email verification service
    return true;
  }

  /**
   * Determine the overall validation status based on individual checks
   */
  private determineValidationStatus(result: EmailValidationResult): void {
    const { details } = result;

    // Calculate score based on checks
    let score = 0;
    let maxScore = 0;

    // Syntax is mandatory
    if (!details.syntax) {
      result.status = VerificationStatus.INVALID;
      result.isValid = false;
      result.reason = 'Invalid email syntax';
      return;
    }
    score += 20;
    maxScore += 20;

    // Domain is mandatory
    if (!details.domain) {
      result.status = VerificationStatus.INVALID;
      result.isValid = false;
      result.reason = 'Invalid domain';
      return;
    }
    score += 20;
    maxScore += 20;

    // MX record check
    maxScore += 15;
    if (details.mx) score += 15;

    // SMTP check
    maxScore += 15;
    if (details.smtp) score += 15;

    // Mailbox check
    maxScore += 15;
    if (details.mailbox) score += 15;

    // Penalty for disposable emails
    maxScore += 10;
    if (!details.disposable) score += 10;

    // Small penalty for role-based emails
    maxScore += 5;
    if (!details.role) score += 5;

    result.score = Math.round((score / maxScore) * 100);

    // Determine status based on score and specific conditions
    if (details.disposable) {
      result.status = VerificationStatus.RISKY;
      result.reason = 'Disposable email address';
    } else if (result.score >= 85) {
      result.status = VerificationStatus.VALID;
      result.isValid = true;
    } else if (result.score >= 60) {
      result.status = VerificationStatus.RISKY;
      result.reason = 'Email may be risky or undeliverable';
    } else if (result.score >= 40) {
      result.status = VerificationStatus.UNKNOWN;
      result.reason = 'Unable to fully verify email';
    } else {
      result.status = VerificationStatus.INVALID;
      result.reason = 'Email appears to be invalid';
    }
  }

  /**
   * Check if email is in cache and not expired
   */
  private isInCache(email: string): boolean {
    if (!this.cache.has(email)) return false;

    const expiry = this.cacheExpiry.get(email);
    if (!expiry || Date.now() > expiry) {
      this.cache.delete(email);
      this.cacheExpiry.delete(email);
      return false;
    }

    return true;
  }

  /**
   * Store verification result in database
   */
  private async storeVerificationResult(
    email: string,
    result: EmailValidationResult,
    tenantId: string
  ): Promise<void> {
    try {
      await this.prisma.emailVerification.upsert({
        where: {
          email_tenantId: {
            email,
            tenantId,
          },
        },
        update: {
          status: result.status,
          verificationData: result as any,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        },
        create: {
          email,
          status: result.status,
          verificationData: result as any,
          verifiedAt: new Date(),
          tenantId,
        },
      });
    } catch (error) {
      console.error('Failed to store verification result:', error);
    }
  }

  /**
   * Get verification result from database
   */
  async getVerificationResult(email: string, tenantId: string): Promise<EmailVerification | null> {
    try {
      const result = await this.prisma.emailVerification.findUnique({
        where: {
          email_tenantId: {
            email: email.toLowerCase().trim(),
            tenantId,
          },
        },
      });

      return result
        ? {
            ...result,
            status: result.status as VerificationStatus,
            verificationData: result.verificationData as Record<string, any> | null,
          }
        : null;
    } catch (error) {
      console.error('Failed to get verification result:', error);
      return null;
    }
  }

  /**
   * Get verification results with pagination
   */
  async getVerificationResults(
    tenantId: string,
    page = 1,
    limit = 50,
    status?: VerificationStatus
  ) {
    try {
      const skip = (page - 1) * limit;

      const where = {
        tenantId,
        ...(status && { status }),
      };

      const [results, total] = await Promise.all([
        this.prisma.emailVerification.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.emailVerification.count({ where }),
      ]);

      return {
        data: results,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Failed to get verification results:', error);
      throw error;
    }
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [email, expiry] of this.cacheExpiry.entries()) {
      if (now > expiry) {
        this.cache.delete(email);
        this.cacheExpiry.delete(email);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses for accurate rate
    };
  }

  /**
   * Start bulk email verification job
   */
  async startBulkVerification(
    emails: string[],
    tenantId: string,
    options: {
      listId?: string;
      removeInvalid?: boolean;
      removeRisky?: boolean;
    } = {}
  ): Promise<BulkVerificationJob> {
    const jobId = `bulk-verification-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

    const job: BulkVerificationJob = {
      id: jobId,
      tenantId,
      totalEmails: emails.length,
      processedEmails: 0,
      validEmails: 0,
      invalidEmails: 0,
      riskyEmails: 0,
      unknownEmails: 0,
      status: 'pending',
      startedAt: new Date(),
    };

    // Store job status in cache for tracking
    this.jobCache.set(jobId, job);

    // Start processing in background
    this.processBulkVerification(jobId, emails, tenantId, options).catch(error => {
      console.error('Bulk verification job failed:', error);
      const failedJob = this.jobCache.get(jobId);
      if (failedJob) {
        failedJob.status = 'failed';
        failedJob.errorMessage = error.message;
        failedJob.completedAt = new Date();
        this.jobCache.set(jobId, failedJob);
      }
    });

    return job;
  }

  /**
   * Process bulk verification job
   */
  private async processBulkVerification(
    jobId: string,
    emails: string[],
    tenantId: string,
    options: {
      listId?: string;
      removeInvalid?: boolean;
      removeRisky?: boolean;
    }
  ): Promise<void> {
    const job = this.jobCache.get(jobId);
    if (!job) return;

    job.status = 'processing';
    this.jobCache.set(jobId, job);

    const batchSize = 10; // Process in batches to avoid overwhelming the system
    const results: EmailValidationResult[] = [];

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);

      // Process batch in parallel
      const batchPromises = batch.map(async email => {
        try {
          const result = await this.validateEmail(email, tenantId, true);

          // Update counters
          switch (result.status) {
            case VerificationStatus.VALID:
              job.validEmails++;
              break;
            case VerificationStatus.INVALID:
              job.invalidEmails++;
              break;
            case VerificationStatus.RISKY:
              job.riskyEmails++;
              break;
            default:
              job.unknownEmails++;
          }

          job.processedEmails++;
          return result;
        } catch (error) {
          console.error(`Failed to validate email ${email}:`, error);
          job.unknownEmails++;
          job.processedEmails++;
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...(batchResults.filter(Boolean) as EmailValidationResult[]));

      // Update job progress
      this.jobCache.set(jobId, job);

      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Handle list cleaning if requested
    if (options.listId && (options.removeInvalid || options.removeRisky)) {
      await this.cleanListBasedOnVerification(
        options.listId,
        results,
        tenantId,
        options.removeInvalid || false,
        options.removeRisky || false
      );
    }

    // Mark job as completed
    job.status = 'completed';
    job.completedAt = new Date();
    this.jobCache.set(jobId, job);
  }

  /**
   * Get bulk verification job status
   */
  getBulkVerificationJob(jobId: string): BulkVerificationJob | null {
    return this.jobCache.get(jobId) || null;
  }

  /**
   * Clean list based on verification results
   */
  private async cleanListBasedOnVerification(
    listId: string,
    results: EmailValidationResult[],
    tenantId: string,
    removeInvalid: boolean,
    removeRisky: boolean
  ): Promise<void> {
    const emailsToRemove: string[] = [];

    for (const result of results) {
      if (
        (removeInvalid && result.status === VerificationStatus.INVALID) ||
        (removeRisky && result.status === VerificationStatus.RISKY)
      ) {
        emailsToRemove.push(result.email);
      }
    }

    if (emailsToRemove.length > 0) {
      // Remove subscribers from the list
      await this.prisma.listSubscriber.deleteMany({
        where: {
          listId,
          subscriber: {
            email: {
              in: emailsToRemove,
            },
            tenantId,
          },
        },
      });

      // Optionally update subscriber status
      await this.prisma.subscriber.updateMany({
        where: {
          email: {
            in: emailsToRemove.filter(
              email => results.find(r => r.email === email)?.status === VerificationStatus.INVALID
            ),
          },
          tenantId,
        },
        data: {
          status: 'INVALID',
        },
      });
    }
  }

  /**
   * Export verification results to CSV
   */
  async exportVerificationResults(
    tenantId: string,
    status?: VerificationStatus,
    format: 'csv' | 'json' = 'csv'
  ): Promise<string> {
    const results = await this.prisma.emailVerification.findMany({
      where: {
        tenantId,
        ...(status && { status }),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (format === 'json') {
      return JSON.stringify(results, null, 2);
    }

    // CSV format
    const headers = ['Email', 'Status', 'Score', 'Reason', 'Verified At', 'Created At'];
    const rows = results.map(result => [
      result.email,
      result.status,
      (result.verificationData as any)?.score || '',
      (result.verificationData as any)?.reason || '',
      result.verifiedAt?.toISOString() || '',
      result.createdAt.toISOString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csvContent;
  }

  /**
   * Get verification statistics for tenant
   */
  async getVerificationStats(tenantId: string) {
    const stats = await this.prisma.emailVerification.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: {
        status: true,
      },
    });

    const result = {
      total: 0,
      valid: 0,
      invalid: 0,
      risky: 0,
      unknown: 0,
      pending: 0,
    };

    for (const stat of stats) {
      result.total += stat._count.status;
      switch (stat.status) {
        case VerificationStatus.VALID:
          result.valid = stat._count.status;
          break;
        case VerificationStatus.INVALID:
          result.invalid = stat._count.status;
          break;
        case VerificationStatus.RISKY:
          result.risky = stat._count.status;
          break;
        case VerificationStatus.UNKNOWN:
          result.unknown = stat._count.status;
          break;
        case VerificationStatus.PENDING:
          result.pending = stat._count.status;
          break;
      }
    }

    return result;
  }
}
