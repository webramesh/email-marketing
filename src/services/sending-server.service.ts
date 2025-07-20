import { prisma } from '@/lib/prisma';
import { SendingServerType, SendingServerConfiguration } from '@/types/email-sending';
import { EmailSendingService } from './email-sending/sending.service';

export interface CreateSendingServerData {
  name: string;
  type: SendingServerType;
  configuration: SendingServerConfiguration;
  isActive?: boolean;
}

export interface UpdateSendingServerData {
  name?: string;
  configuration?: SendingServerConfiguration;
  isActive?: boolean;
}

export class SendingServerService {
  private emailSendingService: EmailSendingService;

  constructor() {
    this.emailSendingService = new EmailSendingService();
  }

  async createSendingServer(tenantId: string, data: CreateSendingServerData) {
    // Validate configuration before creating
    const isValid = await this.emailSendingService.validateServerConfig(
      data.type,
      data.configuration
    );

    if (!isValid) {
      throw new Error('Invalid sending server configuration');
    }

    const server = await prisma.sendingServer.create({
      data: {
        tenantId,
        name: data.name,
        type: data.type,
        configuration: data.configuration as any,
        isActive: data.isActive ?? true,
      },
    });

    return server;
  }

  async updateSendingServer(serverId: string, tenantId: string, data: UpdateSendingServerData) {
    const existingServer = await prisma.sendingServer.findFirst({
      where: {
        id: serverId,
        tenantId,
      },
    });

    if (!existingServer) {
      throw new Error('Sending server not found');
    }

    // If configuration is being updated, validate it
    if (data.configuration) {
      const isValid = await this.emailSendingService.validateServerConfig(
        existingServer.type as SendingServerType,
        data.configuration
      );

      if (!isValid) {
        throw new Error('Invalid sending server configuration');
      }
    }

    const updatedServer = await prisma.sendingServer.update({
      where: {
        id: serverId,
      },
      data: {
        name: data.name,
        configuration: data.configuration as any,
        isActive: data.isActive,
        updatedAt: new Date(),
      },
    });

    return updatedServer;
  }

  async deleteSendingServer(serverId: string, tenantId: string) {
    const server = await prisma.sendingServer.findFirst({
      where: {
        id: serverId,
        tenantId,
      },
    });

    if (!server) {
      throw new Error('Sending server not found');
    }

    await prisma.sendingServer.delete({
      where: {
        id: serverId,
      },
    });

    return { success: true };
  }

  async getSendingServers(tenantId: string) {
    const servers = await prisma.sendingServer.findMany({
      where: {
        tenantId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return servers;
  }

  async getSendingServer(serverId: string, tenantId: string) {
    const server = await prisma.sendingServer.findFirst({
      where: {
        id: serverId,
        tenantId,
      },
    });

    if (!server) {
      throw new Error('Sending server not found');
    }

    return server;
  }

  async testSendingServer(serverId: string, tenantId: string) {
    const isValid = await this.emailSendingService.testServerConnection(serverId, tenantId);

    return {
      success: isValid,
      message: isValid ? 'Connection successful' : 'Connection failed',
    };
  }

  async toggleSendingServer(serverId: string, tenantId: string) {
    const server = await prisma.sendingServer.findFirst({
      where: {
        id: serverId,
        tenantId,
      },
    });

    if (!server) {
      throw new Error('Sending server not found');
    }

    const updatedServer = await prisma.sendingServer.update({
      where: {
        id: serverId,
      },
      data: {
        isActive: !server.isActive,
        updatedAt: new Date(),
      },
    });

    return updatedServer;
  }

  async getSendingServerStats(tenantId: string) {
    const servers = await this.getSendingServers(tenantId);

    // Get stats from audit logs for each server
    const stats = await Promise.all(
      servers.map(async server => {
        const totalSent = await prisma.auditLog.count({
          where: {
            tenantId,
            action: 'EMAIL_SEND',
            resourceId: server.id,
            metadata: {
              path: 'success',
              equals: true,
            },
          },
        });

        const totalFailed = await prisma.auditLog.count({
          where: {
            tenantId,
            action: 'EMAIL_SEND',
            resourceId: server.id,
            metadata: {
              path: 'success',
              equals: false,
            },
          },
        });

        const lastUsed = await prisma.auditLog.findFirst({
          where: {
            tenantId,
            action: 'EMAIL_SEND',
            resourceId: server.id,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            createdAt: true,
          },
        });

        return {
          serverId: server.id,
          serverName: server.name,
          serverType: server.type,
          isActive: server.isActive,
          totalSent,
          totalFailed,
          successRate:
            totalSent + totalFailed > 0 ? (totalSent / (totalSent + totalFailed)) * 100 : 0,
          lastUsed: lastUsed?.createdAt,
        };
      })
    );

    return stats;
  }

  async getAvailableProviders() {
    return [
      {
        type: SendingServerType.AMAZON_SES,
        name: 'Amazon SES',
        description: 'Amazon Simple Email Service',
        configFields: [
          { name: 'accessKeyId', label: 'Access Key ID', type: 'text', required: true },
          { name: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
          {
            name: 'region',
            label: 'AWS Region',
            type: 'text',
            required: true,
            default: 'us-east-1',
          },
          { name: 'configurationSet', label: 'Configuration Set', type: 'text', required: false },
        ],
      },
      {
        type: SendingServerType.SENDGRID,
        name: 'SendGrid',
        description: 'SendGrid Email API',
        configFields: [
          { name: 'apiKey', label: 'API Key', type: 'password', required: true },
          { name: 'ipPoolName', label: 'IP Pool Name', type: 'text', required: false },
        ],
      },
      {
        type: SendingServerType.MAILGUN,
        name: 'Mailgun',
        description: 'Mailgun Email API',
        configFields: [
          { name: 'apiKey', label: 'API Key', type: 'password', required: true },
          { name: 'domain', label: 'Domain', type: 'text', required: true },
          {
            name: 'baseUrl',
            label: 'Base URL',
            type: 'text',
            required: false,
            default: 'https://api.mailgun.net',
          },
        ],
      },
      {
        type: SendingServerType.SPARKPOST,
        name: 'SparkPost',
        description: 'SparkPost Email API',
        configFields: [
          { name: 'apiKey', label: 'API Key', type: 'password', required: true },
          {
            name: 'baseUrl',
            label: 'Base URL',
            type: 'text',
            required: false,
            default: 'https://api.sparkpost.com',
          },
          { name: 'ipPool', label: 'IP Pool', type: 'text', required: false },
        ],
      },
      {
        type: SendingServerType.ELASTICEMAIL,
        name: 'ElasticEmail',
        description: 'ElasticEmail API',
        configFields: [
          { name: 'apiKey', label: 'API Key', type: 'password', required: true },
          {
            name: 'baseUrl',
            label: 'Base URL',
            type: 'text',
            required: false,
            default: 'https://api.elasticemail.com',
          },
        ],
      },
      {
        type: SendingServerType.SMTP,
        name: 'SMTP',
        description: 'Custom SMTP Server',
        configFields: [
          { name: 'host', label: 'SMTP Host', type: 'text', required: true },
          { name: 'port', label: 'Port', type: 'number', required: true, default: 587 },
          { name: 'secure', label: 'Use SSL/TLS', type: 'boolean', required: true, default: false },
          { name: 'username', label: 'Username', type: 'text', required: true },
          { name: 'password', label: 'Password', type: 'password', required: true },
          {
            name: 'pool',
            label: 'Use Connection Pool',
            type: 'boolean',
            required: false,
            default: true,
          },
          {
            name: 'maxConnections',
            label: 'Max Connections',
            type: 'number',
            required: false,
            default: 5,
          },
          {
            name: 'maxMessages',
            label: 'Max Messages per Connection',
            type: 'number',
            required: false,
            default: 100,
          },
        ],
      },
      {
        type: SendingServerType.POSTAL,
        name: 'Postal',
        description: 'Postal Mail Server',
        configFields: [
          { name: 'host', label: 'Postal Host', type: 'text', required: true },
          { name: 'apiKey', label: 'API Key', type: 'password', required: true },
          { name: 'secure', label: 'Use HTTPS', type: 'boolean', required: false, default: true },
        ],
      },
    ];
  }
}
