import { GdprComplianceService, ConsentType, ConsentStatus, DataProcessingPurpose, GdprRequestType, GdprRequestStatus } from '../gdpr-compliance.service';
import { prisma } from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    consentRecord: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    gdprRequest: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    subscriber: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    emailEvent: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    formSubmission: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    supportTicket: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

// Mock crypto functions
jest.mock('crypto', () => ({
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mocked-hash'),
  })),
  randomBytes: jest.fn(() => Buffer.from('mocked-random-bytes')),
}));

// Mock audit service
jest.mock('../security-audit.service', () => ({
  SecurityAuditService: {
    getInstance: jest.fn(() => ({
      logAuditEvent: jest.fn().mockResolvedValue('audit-123'),
    })),
  },
  AuditAction: {
    CONSENT_GIVEN: 'CONSENT_GIVEN',
    CONSENT_WITHDRAWN: 'CONSENT_WITHDRAWN',
    GDPR_DATA_REQUEST: 'GDPR_DATA_REQUEST',
    GDPR_DATA_DELETION: 'GDPR_DATA_DELETION',
    GDPR_DATA_EXPORT: 'GDPR_DATA_EXPORT',
  },
  SecurityRiskLevel: {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL',
  },
}));

describe('GdprComplianceService', () => {
  let gdprService: GdprComplianceService;
  const mockTenantId = 'test-tenant-id';
  const mockEmail = 'test@example.com';

  beforeEach(() => {
    gdprService = GdprComplianceService.getInstance();
    jest.clearAllMocks();
  });

  describe('recordConsent', () => {
    it('should record consent successfully', async () => {
      const mockConsentData = {
        tenantId: mockTenantId,
        email: mockEmail,
        consentType: ConsentType.MARKETING_EMAILS,
        purpose: [DataProcessingPurpose.EMAIL_MARKETING],
        legalBasis: 'consent',
        consentMethod: 'form',
        consentText: 'I agree to receive marketing emails',
        version: '1.0',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
      };

      const mockConsentRecord = {
        id: 'consent-123',
        ...mockConsentData,
        status: ConsentStatus.GIVEN,
        consentDate: new Date(),
      };

      (prisma.consentRecord.create as jest.Mock).mockResolvedValue(mockConsentRecord);

      const result = await gdprService.recordConsent(mockConsentData);

      expect(result).toEqual(mockConsentRecord);
      expect(prisma.consentRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: mockTenantId,
          email: mockEmail,
          consentType: ConsentType.MARKETING_EMAILS,
          status: ConsentStatus.GIVEN,
          purpose: [DataProcessingPurpose.EMAIL_MARKETING],
          legalBasis: 'consent',
          consentMethod: 'form',
          consentText: 'I agree to receive marketing emails',
          version: '1.0',
        }),
      });
    });

    it('should handle consent recording errors', async () => {
      const mockConsentData = {
        tenantId: mockTenantId,
        email: mockEmail,
        consentType: ConsentType.MARKETING_EMAILS,
        purpose: [DataProcessingPurpose.EMAIL_MARKETING],
        legalBasis: 'consent',
        consentMethod: 'form',
        consentText: 'I agree to receive marketing emails',
        version: '1.0',
      };

      const mockError = new Error('Database error');
      (prisma.consentRecord.create as jest.Mock).mockRejectedValue(mockError);

      await expect(gdprService.recordConsent(mockConsentData)).rejects.toThrow(mockError);
    });
  });

  describe('withdrawConsent', () => {
    it('should withdraw consent successfully', async () => {
      const mockWithdrawalData = {
        tenantId: mockTenantId,
        email: mockEmail,
        consentType: ConsentType.MARKETING_EMAILS,
        withdrawalMethod: 'unsubscribe_link',
      };

      (prisma.consentRecord.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.subscriber.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await gdprService.withdrawConsent(mockWithdrawalData);

      expect(prisma.consentRecord.updateMany).toHaveBeenCalledWith({
        where: {
          tenantId: mockTenantId,
          email: mockEmail,
          consentType: ConsentType.MARKETING_EMAILS,
          status: ConsentStatus.GIVEN,
        },
        data: expect.objectContaining({
          status: ConsentStatus.WITHDRAWN,
          withdrawalDate: expect.any(Date),
        }),
      });
    });

    it('should update subscriber status when marketing consent is withdrawn', async () => {
      const mockWithdrawalData = {
        tenantId: mockTenantId,
        email: mockEmail,
        consentType: ConsentType.MARKETING_EMAILS,
        withdrawalMethod: 'unsubscribe_link',
      };

      (prisma.consentRecord.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.subscriber.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await gdprService.withdrawConsent(mockWithdrawalData);

      expect(prisma.subscriber.updateMany).toHaveBeenCalledWith({
        where: { tenantId: mockTenantId, email: mockEmail },
        data: { status: 'UNSUBSCRIBED' },
      });
    });
  });

  describe('createGdprRequest', () => {
    it('should create GDPR request successfully', async () => {
      const mockRequestData = {
        tenantId: mockTenantId,
        requestType: GdprRequestType.ACCESS,
        email: mockEmail,
        firstName: 'John',
        lastName: 'Doe',
      };

      const mockGdprRequest = {
        id: 'gdpr-123',
        ...mockRequestData,
        status: GdprRequestStatus.PENDING,
        requestDate: new Date(),
        verificationToken: 'verification-token',
        verificationExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isVerified: false,
      };

      (prisma.gdprRequest.create as jest.Mock).mockResolvedValue(mockGdprRequest);

      const result = await gdprService.createGdprRequest(mockRequestData);

      expect(result).toEqual(mockGdprRequest);
      expect(prisma.gdprRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: mockTenantId,
          requestType: GdprRequestType.ACCESS,
          email: mockEmail,
          firstName: 'John',
          lastName: 'Doe',
          status: GdprRequestStatus.PENDING,
          isVerified: false,
        }),
      });
    });
  });

  describe('verifyGdprRequest', () => {
    it('should verify GDPR request successfully', async () => {
      const requestId = 'gdpr-123';
      const verificationToken = 'verification-token';

      const mockRequest = {
        id: requestId,
        tenantId: mockTenantId,
        email: mockEmail,
        requestType: GdprRequestType.ACCESS,
        verificationToken,
        verificationExpiry: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        isVerified: false,
      };

      (prisma.gdprRequest.findFirst as jest.Mock).mockResolvedValue(mockRequest);
      (prisma.gdprRequest.update as jest.Mock).mockResolvedValue({
        ...mockRequest,
        isVerified: true,
        status: GdprRequestStatus.IN_PROGRESS,
      });

      // Mock the process request method
      jest.spyOn(gdprService as any, 'processGdprRequest').mockResolvedValue(undefined);

      const result = await gdprService.verifyGdprRequest(mockTenantId, requestId, verificationToken);

      expect(result).toBe(true);
      expect(prisma.gdprRequest.update).toHaveBeenCalledWith({
        where: { id: requestId },
        data: {
          isVerified: true,
          status: GdprRequestStatus.IN_PROGRESS,
        },
      });
    });

    it('should return false for invalid verification token', async () => {
      const requestId = 'gdpr-123';
      const verificationToken = 'invalid-token';

      (prisma.gdprRequest.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await gdprService.verifyGdprRequest(mockTenantId, requestId, verificationToken);

      expect(result).toBe(false);
    });

    it('should return false for expired verification token', async () => {
      const requestId = 'gdpr-123';
      const verificationToken = 'verification-token';

      const mockRequest = {
        id: requestId,
        tenantId: mockTenantId,
        verificationToken,
        verificationExpiry: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago (expired)
        isVerified: false,
      };

      (prisma.gdprRequest.findFirst as jest.Mock).mockResolvedValue(null); // Expired requests won't be found

      const result = await gdprService.verifyGdprRequest(mockTenantId, requestId, verificationToken);

      expect(result).toBe(false);
    });
  });

  describe('getConsentStatus', () => {
    it('should return consent records for a data subject', async () => {
      const mockConsentRecords = [
        {
          id: 'consent-1',
          tenantId: mockTenantId,
          email: mockEmail,
          consentType: ConsentType.MARKETING_EMAILS,
          status: ConsentStatus.GIVEN,
          consentDate: new Date(),
        },
        {
          id: 'consent-2',
          tenantId: mockTenantId,
          email: mockEmail,
          consentType: ConsentType.ANALYTICS_TRACKING,
          status: ConsentStatus.WITHDRAWN,
          consentDate: new Date(),
          withdrawalDate: new Date(),
        },
      ];

      (prisma.consentRecord.findMany as jest.Mock).mockResolvedValue(mockConsentRecords);

      const result = await gdprService.getConsentStatus(mockTenantId, mockEmail);

      expect(result).toEqual(mockConsentRecords);
      expect(prisma.consentRecord.findMany).toHaveBeenCalledWith({
        where: { tenantId: mockTenantId, email: mockEmail },
        orderBy: { consentDate: 'desc' },
      });
    });
  });

  describe('isProcessingAllowed', () => {
    it('should return true when valid consent exists', async () => {
      const mockActiveConsent = {
        id: 'consent-1',
        tenantId: mockTenantId,
        email: mockEmail,
        status: ConsentStatus.GIVEN,
        purpose: [DataProcessingPurpose.EMAIL_MARKETING],
        expiryDate: null,
      };

      (prisma.consentRecord.findFirst as jest.Mock).mockResolvedValue(mockActiveConsent);

      const result = await gdprService.isProcessingAllowed(
        mockTenantId,
        mockEmail,
        DataProcessingPurpose.EMAIL_MARKETING
      );

      expect(result).toBe(true);
    });

    it('should return false when no valid consent exists', async () => {
      (prisma.consentRecord.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await gdprService.isProcessingAllowed(
        mockTenantId,
        mockEmail,
        DataProcessingPurpose.EMAIL_MARKETING
      );

      expect(result).toBe(false);
    });
  });

  describe('Data processing methods', () => {
    beforeEach(() => {
      // Mock all the database queries for data processing
      (prisma.subscriber.findFirst as jest.Mock).mockResolvedValue({
        id: 'subscriber-1',
        email: mockEmail,
        firstName: 'John',
        lastName: 'Doe',
        lists: [],
      });
      (prisma.consentRecord.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.emailEvent.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.formSubmission.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.supportTicket.findMany as jest.Mock).mockResolvedValue([]);
    });

    it('should process data access request', async () => {
      const processDataAccessRequest = (gdprService as any).processDataAccessRequest.bind(gdprService);
      
      const result = await processDataAccessRequest(mockTenantId, mockEmail);

      expect(result).toHaveProperty('personal_data');
      expect(result).toHaveProperty('metadata');
      expect(result.personal_data).toHaveProperty('subscriber_info');
      expect(result.personal_data).toHaveProperty('consent_records');
      expect(result.personal_data).toHaveProperty('email_activity');
      expect(result.metadata).toHaveProperty('export_date');
      expect(result.metadata).toHaveProperty('verification_hash');
    });

    it('should process data erasure request', async () => {
      (prisma.subscriber.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.formSubmission.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
      (prisma.emailEvent.updateMany as jest.Mock).mockResolvedValue({ count: 5 });
      (prisma.supportTicket.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.consentRecord.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

      const processDataErasureRequest = (gdprService as any).processDataErasureRequest.bind(gdprService);
      
      const result = await processDataErasureRequest(mockTenantId, mockEmail);

      expect(result).toHaveProperty('anonymized_records');
      expect(result).toHaveProperty('affected_tables');
      expect(result).toHaveProperty('anonymization_date');
      expect(result).toHaveProperty('verification_hash');
      expect(result.anonymized_records).toBe(11); // 1+2+5+1+2
      expect(result.affected_tables).toContain('subscribers');
      expect(result.affected_tables).toContain('form_submissions');
    });
  });

  describe('Privacy policy generation', () => {
    it('should generate privacy policy', async () => {
      const result = await gdprService.generatePrivacyPolicy(mockTenantId);

      expect(result).toHaveProperty('policy');
      expect(result).toHaveProperty('lastUpdated');
      expect(result).toHaveProperty('version');
      expect(result.policy).toContain('Privacy Policy');
      expect(result.policy).toContain('Data Controller');
      expect(result.policy).toContain('Your Rights');
    });
  });

  describe('Helper methods', () => {
    it('should anonymize email addresses correctly', async () => {
      const anonymizeEmail = (gdprService as any).anonymizeEmail.bind(gdprService);
      
      const anonymizedEmail = anonymizeEmail('test@example.com');
      
      // The mocked hash returns 'mocked-hash', so we take the first 8 characters: 'mocked-h'
      expect(anonymizedEmail).toBe('anonymized_mocked-h@anonymized.local');
    });

    it('should hash email addresses consistently', async () => {
      const hashEmail = (gdprService as any).hashEmail.bind(gdprService);
      
      const hash1 = hashEmail('test@example.com');
      const hash2 = hashEmail('test@example.com');
      
      expect(hash1).toBe(hash2);
      expect(hash1).toBe('mocked-hash');
    });
  });
});