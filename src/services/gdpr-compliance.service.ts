import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';
import { SecurityAuditService, AuditAction, SecurityRiskLevel } from './security-audit.service';
import { createAuditContext } from '@/lib/audit-middleware';
import { createHash, randomBytes } from 'crypto';

export enum ConsentType {
  MARKETING_EMAILS = 'MARKETING_EMAILS',
  ANALYTICS_TRACKING = 'ANALYTICS_TRACKING',
  THIRD_PARTY_SHARING = 'THIRD_PARTY_SHARING',
  PROFILING = 'PROFILING',
  AUTOMATED_DECISION_MAKING = 'AUTOMATED_DECISION_MAKING',
}

export enum ConsentStatus {
  GIVEN = 'GIVEN',
  WITHDRAWN = 'WITHDRAWN',
  PENDING = 'PENDING',
  EXPIRED = 'EXPIRED',
}

export enum DataProcessingPurpose {
  EMAIL_MARKETING = 'EMAIL_MARKETING',
  CUSTOMER_SUPPORT = 'CUSTOMER_SUPPORT',
  ANALYTICS = 'ANALYTICS',
  BILLING = 'BILLING',
  LEGAL_COMPLIANCE = 'LEGAL_COMPLIANCE',
  SECURITY = 'SECURITY',
}

export enum GdprRequestType {
  ACCESS = 'ACCESS', // Right to access
  RECTIFICATION = 'RECTIFICATION', // Right to rectification
  ERASURE = 'ERASURE', // Right to erasure (right to be forgotten)
  PORTABILITY = 'PORTABILITY', // Right to data portability
  RESTRICTION = 'RESTRICTION', // Right to restriction of processing
  OBJECTION = 'OBJECTION', // Right to object
}

export enum GdprRequestStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export interface ConsentRecord {
  id: string;
  tenantId: string;
  subscriberId?: string;
  email: string;
  consentType: ConsentType;
  status: ConsentStatus;
  purpose: DataProcessingPurpose[];
  legalBasis: string;
  consentDate: Date;
  withdrawalDate?: Date;
  expiryDate?: Date;
  ipAddress?: string;
  userAgent?: string;
  consentMethod: string; // 'form', 'email', 'api', etc.
  consentText: string;
  version: string;
  metadata?: Record<string, any>;
}

export interface GdprRequest {
  id: string;
  tenantId: string;
  requestType: GdprRequestType;
  status: GdprRequestStatus;
  email: string;
  firstName?: string;
  lastName?: string;
  requestDate: Date;
  completionDate?: Date;
  verificationToken: string;
  verificationExpiry: Date;
  isVerified: boolean;
  requestDetails?: Record<string, any>;
  responseData?: Record<string, any>;
  rejectionReason?: string;
  metadata?: Record<string, any>;
}

export interface DataExportResult {
  personal_data: {
    subscriber_info: any;
    consent_records: ConsentRecord[];
    email_activity: any[];
    campaign_interactions: any[];
    form_submissions: any[];
    support_tickets: any[];
  };
  metadata: {
    export_date: string;
    tenant_id: string;
    data_retention_policy: string;
    export_format: string;
    verification_hash: string;
  };
}

export interface AnonymizationResult {
  anonymized_records: number;
  affected_tables: string[];
  anonymization_date: string;
  retention_period: string;
  verification_hash: string;
}

export class GdprComplianceService {
  private static instance: GdprComplianceService;
  private auditService: SecurityAuditService;

  constructor() {
    this.auditService = SecurityAuditService.getInstance();
  }

  static getInstance(): GdprComplianceService {
    if (!GdprComplianceService.instance) {
      GdprComplianceService.instance = new GdprComplianceService();
    }
    return GdprComplianceService.instance;
  }

  /**
   * Record consent given by a data subject
   */
  async recordConsent(data: {
    tenantId: string;
    subscriberId?: string;
    email: string;
    consentType: ConsentType;
    purpose: DataProcessingPurpose[];
    legalBasis: string;
    consentMethod: string;
    consentText: string;
    version: string;
    ipAddress?: string;
    userAgent?: string;
    expiryDate?: Date;
    metadata?: Record<string, any>;
  }): Promise<ConsentRecord> {
    try {
      const consentId = this.generateConsentId();
      const consentDate = new Date();

      // Create consent record
      const consentRecord = await prisma.consentRecord.create({
        data: {
          id: consentId,
          tenantId: data.tenantId,
          subscriberId: data.subscriberId,
          email: data.email,
          consentType: data.consentType,
          status: ConsentStatus.GIVEN,
          purpose: data.purpose,
          legalBasis: data.legalBasis,
          consentDate,
          expiryDate: data.expiryDate,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          consentMethod: data.consentMethod,
          consentText: data.consentText,
          version: data.version,
          metadata: data.metadata,
        },
      });

      // Log consent event
      const auditContext = await createAuditContext(data.tenantId);
      await this.auditService.logAuditEvent({
        ...auditContext,
        action: AuditAction.CONSENT_GIVEN,
        resource: 'consent',
        resourceId: consentId,
        metadata: {
          email: data.email,
          consentType: data.consentType,
          purpose: data.purpose,
          legalBasis: data.legalBasis,
          consentMethod: data.consentMethod,
        },
        riskLevel: SecurityRiskLevel.LOW,
      });

      return consentRecord as ConsentRecord;
    } catch (error) {
      console.error('Failed to record consent:', error);
      throw error;
    }
  }

  /**
   * Withdraw consent for a data subject
   */
  async withdrawConsent(data: {
    tenantId: string;
    email: string;
    consentType: ConsentType;
    withdrawalMethod: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const withdrawalDate = new Date();

      // Update consent record
      await prisma.consentRecord.updateMany({
        where: {
          tenantId: data.tenantId,
          email: data.email,
          consentType: data.consentType,
          status: ConsentStatus.GIVEN,
        },
        data: {
          status: ConsentStatus.WITHDRAWN,
          withdrawalDate,
          metadata: {
            ...data.metadata,
            withdrawalMethod: data.withdrawalMethod,
            withdrawalIpAddress: data.ipAddress,
            withdrawalUserAgent: data.userAgent,
          },
        },
      });

      // Log consent withdrawal
      const auditContext = await createAuditContext(data.tenantId);
      await this.auditService.logAuditEvent({
        ...auditContext,
        action: AuditAction.CONSENT_WITHDRAWN,
        resource: 'consent',
        metadata: {
          email: data.email,
          consentType: data.consentType,
          withdrawalMethod: data.withdrawalMethod,
        },
        riskLevel: SecurityRiskLevel.MEDIUM,
      });

      // If marketing consent is withdrawn, update subscriber status
      if (data.consentType === ConsentType.MARKETING_EMAILS) {
        await this.updateSubscriberStatusOnConsentWithdrawal(data.tenantId, data.email);
      }
    } catch (error) {
      console.error('Failed to withdraw consent:', error);
      throw error;
    }
  }

  /**
   * Create a GDPR data request
   */
  async createGdprRequest(data: {
    tenantId: string;
    requestType: GdprRequestType;
    email: string;
    firstName?: string;
    lastName?: string;
    requestDetails?: Record<string, any>;
    metadata?: Record<string, any>;
  }): Promise<GdprRequest> {
    try {
      const requestId = this.generateRequestId();
      const verificationToken = this.generateVerificationToken();
      const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const gdprRequest = await prisma.gdprRequest.create({
        data: {
          id: requestId,
          tenantId: data.tenantId,
          requestType: data.requestType,
          status: GdprRequestStatus.PENDING,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          requestDate: new Date(),
          verificationToken,
          verificationExpiry,
          isVerified: false,
          requestDetails: data.requestDetails,
          metadata: data.metadata,
        },
      });

      // Log GDPR request
      const auditContext = await createAuditContext(data.tenantId);
      await this.auditService.logAuditEvent({
        ...auditContext,
        action: AuditAction.GDPR_DATA_REQUEST,
        resource: 'gdpr_request',
        resourceId: requestId,
        metadata: {
          email: data.email,
          requestType: data.requestType,
          verificationRequired: true,
        },
        riskLevel: SecurityRiskLevel.HIGH,
      });

      // Send verification email (would be implemented separately)
      await this.sendVerificationEmail(
        data.tenantId,
        data.email,
        verificationToken,
        data.requestType
      );

      return gdprRequest as GdprRequest;
    } catch (error) {
      console.error('Failed to create GDPR request:', error);
      throw error;
    }
  }

  /**
   * Verify GDPR request with token
   */
  async verifyGdprRequest(
    tenantId: string,
    requestId: string,
    verificationToken: string
  ): Promise<boolean> {
    try {
      const request = await prisma.gdprRequest.findFirst({
        where: {
          id: requestId,
          tenantId,
          verificationToken,
          verificationExpiry: {
            gt: new Date(),
          },
          isVerified: false,
        },
      });

      if (!request) {
        return false;
      }

      // Mark as verified and update status
      await prisma.gdprRequest.update({
        where: { id: requestId },
        data: {
          isVerified: true,
          status: GdprRequestStatus.IN_PROGRESS,
        },
      });

      // Log verification
      const auditContext = await createAuditContext(tenantId);
      await this.auditService.logAuditEvent({
        ...auditContext,
        action: AuditAction.GDPR_DATA_REQUEST,
        resource: 'gdpr_request',
        resourceId: requestId,
        metadata: {
          email: request.email,
          requestType: request.requestType,
          verified: true,
        },
        riskLevel: SecurityRiskLevel.HIGH,
      });

      // Process the request automatically
      await this.processGdprRequest(requestId);

      return true;
    } catch (error) {
      console.error('Failed to verify GDPR request:', error);
      throw error;
    }
  }

  /**
   * Process a verified GDPR request
   */
  async processGdprRequest(requestId: string): Promise<void> {
    try {
      const request = await prisma.gdprRequest.findUnique({
        where: { id: requestId },
      });

      if (!request || !request.isVerified) {
        throw new Error('Request not found or not verified');
      }

      let responseData: any = {};

      switch (request.requestType) {
        case GdprRequestType.ACCESS:
          responseData = await this.processDataAccessRequest(request.tenantId, request.email);
          break;
        case GdprRequestType.ERASURE:
          responseData = await this.processDataErasureRequest(request.tenantId, request.email);
          break;
        case GdprRequestType.PORTABILITY:
          responseData = await this.processDataPortabilityRequest(request.tenantId, request.email);
          break;
        case GdprRequestType.RECTIFICATION:
          responseData = await this.processDataRectificationRequest(
            request,
            request.requestDetails as Record<string, any> | undefined
          );
          break;
        case GdprRequestType.RESTRICTION:
          responseData = await this.processDataRestrictionRequest(request.tenantId, request.email);
          break;
        case GdprRequestType.OBJECTION:
          responseData = await this.processDataObjectionRequest(request.tenantId, request.email);
          break;
        default:
          throw new Error(`Unsupported request type: ${request.requestType}`);
      }

      // Update request status
      await prisma.gdprRequest.update({
        where: { id: requestId },
        data: {
          status: GdprRequestStatus.COMPLETED,
          completionDate: new Date(),
          responseData,
        },
      });

      // Log completion
      const auditContext = await createAuditContext(request.tenantId);
      await this.auditService.logAuditEvent({
        ...auditContext,
        action:
          request.requestType === GdprRequestType.ERASURE
            ? AuditAction.GDPR_DATA_DELETION
            : AuditAction.GDPR_DATA_EXPORT,
        resource: 'gdpr_request',
        resourceId: requestId,
        metadata: {
          email: request.email,
          requestType: request.requestType,
          completed: true,
          responseDataSize: JSON.stringify(responseData).length,
        },
        riskLevel: SecurityRiskLevel.HIGH,
      });
    } catch (error) {
      console.error('Failed to process GDPR request:', error);

      // Update request status to failed
      await prisma.gdprRequest.update({
        where: { id: requestId },
        data: {
          status: GdprRequestStatus.REJECTED,
          rejectionReason: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  /**
   * Process data access request (Right to Access)
   */
  private async processDataAccessRequest(
    tenantId: string,
    email: string
  ): Promise<DataExportResult> {
    try {
      // Get subscriber data
      const subscriber = await prisma.subscriber.findFirst({
        where: { tenantId, email },
        include: {
          lists: {
            include: {
              list: true,
            },
          },
        },
      });

      // Get consent records
      const consentRecords = await prisma.consentRecord.findMany({
        where: { tenantId, email },
      });

      // Get email events
      const emailEvents = await prisma.emailEvent.findMany({
        where: { tenantId, email },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              subject: true,
            },
          },
        },
      });

      // Get form submissions
      const formSubmissions = await prisma.formSubmission.findMany({
        where: { email },
        include: {
          form: {
            select: {
              id: true,
              name: true,
              tenantId: true,
            },
          },
        },
      });

      // Get support tickets
      const supportTickets = await prisma.supportTicket.findMany({
        where: { tenantId, requesterEmail: email },
        select: {
          id: true,
          ticketNumber: true,
          subject: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const personalData = {
        subscriber_info: subscriber
          ? {
              id: subscriber.id,
              email: subscriber.email,
              firstName: subscriber.firstName,
              lastName: subscriber.lastName,
              status: subscriber.status,
              customFields: subscriber.customFields,
              createdAt: subscriber.createdAt,
              updatedAt: subscriber.updatedAt,
              lists: subscriber.lists.map(l => ({
                listId: l.list.id,
                listName: l.list.name,
                joinedAt: l.createdAt,
              })),
            }
          : null,
        consent_records: consentRecords as ConsentRecord[],
        email_activity: emailEvents.map(event => ({
          id: event.id,
          type: event.type,
          campaignId: event.campaign?.id,
          campaignName: event.campaign?.name,
          campaignSubject: event.campaign?.subject,
          timestamp: event.createdAt,
          ipAddress: event.ipAddress,
          location: event.location,
        })),
        campaign_interactions: emailEvents.filter(e =>
          ['OPENED', 'CLICKED', 'UNSUBSCRIBED'].includes(e.type)
        ),
        form_submissions: formSubmissions.map(submission => ({
          id: submission.id,
          formId: submission.form.id,
          formName: submission.form.name,
          submittedAt: submission.createdAt,
          customFields: submission.customFields,
          ipAddress: submission.ipAddress,
          location: submission.location,
        })),
        support_tickets: supportTickets,
      };

      const exportData: DataExportResult = {
        personal_data: personalData,
        metadata: {
          export_date: new Date().toISOString(),
          tenant_id: tenantId,
          data_retention_policy: '7 years from last activity',
          export_format: 'JSON',
          verification_hash: this.generateDataHash(personalData),
        },
      };

      return exportData;
    } catch (error) {
      console.error('Failed to process data access request:', error);
      throw error;
    }
  }

  /**
   * Process data erasure request (Right to be Forgotten)
   */
  private async processDataErasureRequest(
    tenantId: string,
    email: string
  ): Promise<AnonymizationResult> {
    try {
      const anonymizationDate = new Date().toISOString();
      const affectedTables: string[] = [];
      let anonymizedRecords = 0;

      // Anonymize subscriber data
      const subscriberResult = await prisma.subscriber.updateMany({
        where: { tenantId, email },
        data: {
          email: this.anonymizeEmail(email),
          firstName: '[ANONYMIZED]',
          lastName: '[ANONYMIZED]',
          customFields: { anonymized: true, originalEmail: this.hashEmail(email) },
          status: 'INVALID',
        },
      });
      if (subscriberResult.count > 0) {
        affectedTables.push('subscribers');
        anonymizedRecords += subscriberResult.count;
      }

      // Anonymize form submissions
      const formSubmissionResult = await prisma.formSubmission.updateMany({
        where: { email },
        data: {
          email: this.anonymizeEmail(email),
          firstName: '[ANONYMIZED]',
          lastName: '[ANONYMIZED]',
          customFields: { anonymized: true },
          ipAddress: null,
          userAgent: null,
        },
      });
      if (formSubmissionResult.count > 0) {
        affectedTables.push('form_submissions');
        anonymizedRecords += formSubmissionResult.count;
      }

      // Anonymize email events (keep for analytics but remove PII)
      const emailEventResult = await prisma.emailEvent.updateMany({
        where: { tenantId, email },
        data: {
          email: this.anonymizeEmail(email),
          ipAddress: null,
          userAgent: null,
          location: Prisma.JsonNull,
        },
      });
      if (emailEventResult.count > 0) {
        affectedTables.push('email_events');
        anonymizedRecords += emailEventResult.count;
      }

      // Anonymize support tickets
      const supportTicketResult = await prisma.supportTicket.updateMany({
        where: { tenantId, requesterEmail: email },
        data: {
          requesterEmail: this.anonymizeEmail(email),
          requesterName: '[ANONYMIZED]',
          description: '[CONTENT ANONYMIZED DUE TO GDPR REQUEST]',
        },
      });
      if (supportTicketResult.count > 0) {
        affectedTables.push('support_tickets');
        anonymizedRecords += supportTicketResult.count;
      }

      // Mark consent records as withdrawn
      const consentResult = await prisma.consentRecord.updateMany({
        where: { tenantId, email },
        data: {
          status: ConsentStatus.WITHDRAWN,
          withdrawalDate: new Date(),
          metadata: {
            withdrawalReason: 'GDPR_ERASURE_REQUEST',
            anonymized: true,
          },
        },
      });
      if (consentResult.count > 0) {
        affectedTables.push('consent_records');
        anonymizedRecords += consentResult.count;
      }

      const result: AnonymizationResult = {
        anonymized_records: anonymizedRecords,
        affected_tables: affectedTables,
        anonymization_date: anonymizationDate,
        retention_period: 'Data anonymized permanently',
        verification_hash: this.generateDataHash({
          email: this.hashEmail(email),
          anonymizationDate,
          affectedTables,
          anonymizedRecords,
        }),
      };

      return result;
    } catch (error) {
      console.error('Failed to process data erasure request:', error);
      throw error;
    }
  }

  /**
   * Process data portability request
   */
  private async processDataPortabilityRequest(
    tenantId: string,
    email: string
  ): Promise<DataExportResult> {
    // Data portability is similar to data access but in a structured, machine-readable format
    return this.processDataAccessRequest(tenantId, email);
  }

  /**
   * Process data rectification request
   */
  private async processDataRectificationRequest(
    request: any,
    requestDetails?: Record<string, any>
  ): Promise<any> {
    try {
      if (!requestDetails || !requestDetails.corrections) {
        throw new Error('Rectification details not provided');
      }

      const corrections = requestDetails.corrections;
      const result: any = { updated_fields: [] };

      // Update subscriber data if corrections are provided
      if (corrections.subscriber) {
        const updateData: any = {};

        if (corrections.subscriber.firstName) {
          updateData.firstName = corrections.subscriber.firstName;
          result.updated_fields.push('firstName');
        }

        if (corrections.subscriber.lastName) {
          updateData.lastName = corrections.subscriber.lastName;
          result.updated_fields.push('lastName');
        }

        if (corrections.subscriber.customFields) {
          updateData.customFields = corrections.subscriber.customFields;
          result.updated_fields.push('customFields');
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.subscriber.updateMany({
            where: { tenantId: request.tenantId, email: request.email },
            data: updateData,
          });
        }
      }

      result.rectification_date = new Date().toISOString();
      result.verification_hash = this.generateDataHash(result);

      return result;
    } catch (error) {
      console.error('Failed to process data rectification request:', error);
      throw error;
    }
  }

  /**
   * Process data restriction request
   */
  private async processDataRestrictionRequest(tenantId: string, email: string): Promise<any> {
    try {
      // Mark subscriber as restricted (pause processing)
      await prisma.subscriber.updateMany({
        where: { tenantId, email },
        data: {
          customFields: {
            processing_restricted: true,
            restriction_date: new Date().toISOString(),
            restriction_reason: 'GDPR_RESTRICTION_REQUEST',
          },
        },
      });

      return {
        restriction_applied: true,
        restriction_date: new Date().toISOString(),
        affected_processing: ['email_campaigns', 'analytics', 'profiling'],
        verification_hash: this.generateDataHash({ email, restricted: true }),
      };
    } catch (error) {
      console.error('Failed to process data restriction request:', error);
      throw error;
    }
  }

  /**
   * Process data objection request
   */
  private async processDataObjectionRequest(tenantId: string, email: string): Promise<any> {
    try {
      // Withdraw marketing consent and update subscriber status
      await this.withdrawConsent({
        tenantId,
        email,
        consentType: ConsentType.MARKETING_EMAILS,
        withdrawalMethod: 'GDPR_OBJECTION_REQUEST',
      });

      // Update subscriber status
      await prisma.subscriber.updateMany({
        where: { tenantId, email },
        data: {
          status: 'UNSUBSCRIBED',
          customFields: {
            objection_date: new Date().toISOString(),
            objection_reason: 'GDPR_OBJECTION_REQUEST',
          },
        },
      });

      return {
        objection_processed: true,
        objection_date: new Date().toISOString(),
        marketing_consent_withdrawn: true,
        subscriber_status_updated: true,
        verification_hash: this.generateDataHash({ email, objection: true }),
      };
    } catch (error) {
      console.error('Failed to process data objection request:', error);
      throw error;
    }
  }

  /**
   * Get consent status for a data subject
   */
  async getConsentStatus(tenantId: string, email: string): Promise<ConsentRecord[]> {
    try {
      const consentRecords = await prisma.consentRecord.findMany({
        where: { tenantId, email },
        orderBy: { consentDate: 'desc' },
      });

      return consentRecords as ConsentRecord[];
    } catch (error) {
      console.error('Failed to get consent status:', error);
      throw error;
    }
  }

  /**
   * Check if processing is allowed for a specific purpose
   */
  async isProcessingAllowed(
    tenantId: string,
    email: string,
    purpose: DataProcessingPurpose
  ): Promise<boolean> {
    try {
      const activeConsent = await prisma.consentRecord.findFirst({
        where: {
          tenantId,
          email,
          status: ConsentStatus.GIVEN,
          purpose: {
            array_contains: purpose,
          },
          OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }],
        },
      });

      return !!activeConsent;
    } catch (error) {
      console.error('Failed to check processing permission:', error);
      return false;
    }
  }

  /**
   * Generate privacy policy and consent forms
   */
  async generatePrivacyPolicy(tenantId: string): Promise<{
    policy: string;
    lastUpdated: string;
    version: string;
  }> {
    // This would generate a privacy policy based on the tenant's data processing activities
    // For now, return a template
    return {
      policy: `
# Privacy Policy

## Data Controller
[Tenant Name] is the data controller for your personal data.

## Data We Collect
- Email address
- Name (first and last)
- Communication preferences
- Email interaction data (opens, clicks)
- Technical data (IP address, browser information)

## Legal Basis for Processing
- Consent for marketing communications
- Legitimate interest for service provision
- Legal obligation for compliance

## Your Rights
- Right to access your data
- Right to rectification
- Right to erasure (right to be forgotten)
- Right to data portability
- Right to restrict processing
- Right to object to processing

## Data Retention
We retain your data for as long as necessary to provide our services and comply with legal obligations.

## Contact Information
To exercise your rights or for privacy questions, contact: privacy@[tenant-domain]
      `,
      lastUpdated: new Date().toISOString(),
      version: '1.0',
    };
  }

  /**
   * Helper methods
   */
  private generateConsentId(): string {
    return `consent_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  private generateRequestId(): string {
    return `gdpr_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  private generateVerificationToken(): string {
    return randomBytes(32).toString('hex');
  }

  private generateDataHash(data: any): string {
    return createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  private hashEmail(email: string): string {
    return createHash('sha256').update(email).digest('hex');
  }

  private anonymizeEmail(email: string): string {
    const hash = this.hashEmail(email).substring(0, 8);
    return `anonymized_${hash}@anonymized.local`;
  }

  private async updateSubscriberStatusOnConsentWithdrawal(
    tenantId: string,
    email: string
  ): Promise<void> {
    await prisma.subscriber.updateMany({
      where: { tenantId, email },
      data: { status: 'UNSUBSCRIBED' },
    });
  }

  private async sendVerificationEmail(
    tenantId: string,
    email: string,
    verificationToken: string,
    requestType: GdprRequestType
  ): Promise<void> {
    // This would integrate with the email sending service
    // For now, just log the verification email
    console.log('GDPR_VERIFICATION_EMAIL:', {
      tenantId,
      email,
      verificationToken,
      requestType,
      verificationUrl: `https://[tenant-domain]/gdpr/verify?token=${verificationToken}`,
    });
  }
}
