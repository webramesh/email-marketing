import { EmailSendingService } from '../sending.service';
import { EmailMessage, SendingServerType } from '@/types/email-sending';
import { prisma } from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    sendingServer: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

// Mock providers
jest.mock('../providers/amazon-ses.provider');
jest.mock('../providers/sendgrid.provider');
jest.mock('../providers/mailgun.provider');
jest.mock('../providers/sparkpost.provider');
jest.mock('../providers/elasticemail.provider');
jest.mock('../providers/smtp.provider');
jest.mock('../providers/postal.provider');

describe('EmailSendingService', () => {
  let service: EmailSendingService;
  const mockTenantId = 'tenant-123';

  beforeEach(() => {
    service = new EmailSendingService();
    jest.clearAllMocks();
  });

  const mockEmailMessage: EmailMessage = {
    to: 'test@example.com',
    from: 'sender@example.com',
    subject: 'Test Email',
    html: '<p>Test content</p>',
  };

  const mockSendingServer = {
    id: 'server-123',
    name: 'Test Server',
    type: SendingServerType.SMTP,
    isActive: true,
    configuration: {
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      username: 'user',
      password: 'pass',
    },
  };

  describe('sendEmail', () => {
    it('should return error when no active servers are configured', async () => {
      (prisma.sendingServer.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.sendEmail(mockEmailMessage, mockTenantId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No active sending servers configured');
      expect(result.provider).toBe('none');
    });

    it('should send email using available server', async () => {
      (prisma.sendingServer.findMany as jest.Mock).mockResolvedValue([
        {
          id: mockSendingServer.id,
          name: mockSendingServer.name,
          type: mockSendingServer.type,
          isActive: mockSendingServer.isActive,
          configuration: mockSendingServer.configuration,
        },
      ]);

      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.sendEmail(mockEmailMessage, mockTenantId);

      expect(prisma.sendingServer.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: mockTenantId,
          isActive: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
    });

    it('should use round-robin strategy by default', async () => {
      const servers = [
        { ...mockSendingServer, id: 'server-1' },
        { ...mockSendingServer, id: 'server-2' },
        { ...mockSendingServer, id: 'server-3' },
      ];

      (prisma.sendingServer.findMany as jest.Mock).mockResolvedValue(
        servers.map(s => ({
          id: s.id,
          name: s.name,
          type: s.type,
          isActive: s.isActive,
          configuration: s.configuration,
        }))
      );

      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      // Test multiple sends to verify round-robin behavior
      await service.sendEmail(mockEmailMessage, mockTenantId);
      await service.sendEmail(mockEmailMessage, mockTenantId);
      await service.sendEmail(mockEmailMessage, mockTenantId);

      expect(prisma.auditLog.create).toHaveBeenCalledTimes(3);
    });
  });

  describe('validateServerConfig', () => {
    it('should return false for unknown provider type', async () => {
      const result = await service.validateServerConfig(
        'unknown' as SendingServerType,
        {}
      );

      expect(result).toBe(false);
    });
  });

  describe('testServerConnection', () => {
    it('should return false when server is not found', async () => {
      (prisma.sendingServer.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.testServerConnection('invalid-id', mockTenantId);

      expect(result).toBe(false);
    });

    it('should test server configuration when server exists', async () => {
      (prisma.sendingServer.findFirst as jest.Mock).mockResolvedValue({
        id: mockSendingServer.id,
        type: mockSendingServer.type,
        configuration: mockSendingServer.configuration,
      });

      const result = await service.testServerConnection(mockSendingServer.id, mockTenantId);

      expect(prisma.sendingServer.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockSendingServer.id,
          tenantId: mockTenantId,
        },
      });
    });
  });
});