import { prisma } from '@/lib/prisma';
import { 
  EmailMessage, 
  SendingResult, 
  SendingServerConfig, 
  SendingServerType, 
  LoadBalancingStrategy,
  SendingProvider
} from '@/types/email-sending';
import { AmazonSESProvider } from './providers/amazon-ses.provider';
import { SendGridProvider } from './providers/sendgrid.provider';
import { MailgunProvider } from './providers/mailgun.provider';
import { SparkPostProvider } from './providers/sparkpost.provider';
import { ElasticEmailProvider } from './providers/elasticemail.provider';
import { SMTPProvider } from './providers/smtp.provider';
import { PostalProvider } from './providers/postal.provider';

export class EmailSendingService {
  private providers: Map<SendingServerType, SendingProvider> = new Map();
  private serverStats: Map<string, { sent: number, lastUsed: Date }> = new Map();

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    this.providers.set(SendingServerType.AMAZON_SES, new AmazonSESProvider());
    this.providers.set(SendingServerType.SENDGRID, new SendGridProvider());
    this.providers.set(SendingServerType.MAILGUN, new MailgunProvider());
    this.providers.set(SendingServerType.SPARKPOST, new SparkPostProvider());
    this.providers.set(SendingServerType.ELASTICEMAIL, new ElasticEmailProvider());
    this.providers.set(SendingServerType.SMTP, new SMTPProvider());
    this.providers.set(SendingServerType.POSTAL, new PostalProvider());
  }

  async sendEmail(
    message: EmailMessage, 
    tenantId: string, 
    strategy: LoadBalancingStrategy = { type: 'round_robin' }
  ): Promise<SendingResult> {
    const servers = await this.getActiveSendingServers(tenantId);
    
    if (servers.length === 0) {
      return {
        success: false,
        error: 'No active sending servers configured',
        provider: 'none',
        timestamp: new Date()
      };
    }

    const selectedServer = this.selectServer(servers, strategy);
    
    // Check rate limits
    if (await this.isRateLimited(selectedServer)) {
      // Try next available server
      const availableServers = servers.filter(s => s.id !== selectedServer.id);
      if (availableServers.length > 0) {
        const fallbackServer = this.selectServer(availableServers, strategy);
        return this.sendWithServer(message, fallbackServer, tenantId);
      } else {
        return {
          success: false,
          error: 'All sending servers are rate limited',
          provider: selectedServer.type,
          timestamp: new Date()
        };
      }
    }

    return this.sendWithServer(message, selectedServer, tenantId);
  }

  private async sendWithServer(
    message: EmailMessage, 
    server: SendingServerConfig, 
    tenantId: string
  ): Promise<SendingResult> {
    const provider = this.providers.get(server.type as SendingServerType);
    
    if (!provider) {
      return {
        success: false,
        error: `Provider not found for type: ${server.type}`,
        provider: server.type,
        timestamp: new Date()
      };
    }

    try {
      const result = await provider.send(message, server.configuration);
      
      // Update server stats
      await this.updateServerStats(server.id, result.success);
      
      // Log the sending attempt
      await this.logSendingAttempt(tenantId, server.id, message, result);
      
      return result;
    } catch (error) {
      console.error(`Error sending with server ${server.name}:`, error);
      
      const errorResult: SendingResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: server.type,
        timestamp: new Date()
      };
      
      await this.logSendingAttempt(tenantId, server.id, message, errorResult);
      
      return errorResult;
    }
  }

  private async getActiveSendingServers(tenantId: string): Promise<SendingServerConfig[]> {
    const servers = await prisma.sendingServer.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return servers.map(server => ({
      id: server.id,
      name: server.name,
      type: server.type as SendingServerType,
      isActive: server.isActive,
      priority: 1, // Default priority, can be added to schema later
      configuration: server.configuration as any,
    }));
  }

  private selectServer(
    servers: SendingServerConfig[], 
    strategy: LoadBalancingStrategy
  ): SendingServerConfig {
    switch (strategy.type) {
      case 'round_robin':
        return this.selectRoundRobin(servers);
      case 'weighted':
        return this.selectWeighted(servers, strategy.weights || {});
      case 'least_used':
        return this.selectLeastUsed(servers);
      case 'failover':
        return servers[0]; // Use first available server
      default:
        return servers[0];
    }
  }

  private selectRoundRobin(servers: SendingServerConfig[]): SendingServerConfig {
    // Simple round-robin based on current time
    const index = Date.now() % servers.length;
    return servers[index];
  }

  private selectWeighted(
    servers: SendingServerConfig[], 
    weights: Record<string, number>
  ): SendingServerConfig {
    const totalWeight = servers.reduce((sum, server) => {
      return sum + (weights[server.id] || 1);
    }, 0);

    let random = Math.random() * totalWeight;
    
    for (const server of servers) {
      const weight = weights[server.id] || 1;
      random -= weight;
      if (random <= 0) {
        return server;
      }
    }
    
    return servers[0];
  }

  private selectLeastUsed(servers: SendingServerConfig[]): SendingServerConfig {
    return servers.reduce((least, current) => {
      const leastStats = this.serverStats.get(least.id);
      const currentStats = this.serverStats.get(current.id);
      
      const leastSent = leastStats?.sent || 0;
      const currentSent = currentStats?.sent || 0;
      
      return currentSent < leastSent ? current : least;
    });
  }

  private async isRateLimited(server: SendingServerConfig): Promise<boolean> {
    if (!server.dailyLimit && !server.hourlyLimit) {
      return false;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());

    // Check daily limit
    if (server.dailyLimit) {
      const dailySent = await this.getSentCount(server.id, today);
      if (dailySent >= server.dailyLimit) {
        return true;
      }
    }

    // Check hourly limit
    if (server.hourlyLimit) {
      const hourlySent = await this.getSentCount(server.id, thisHour);
      if (hourlySent >= server.hourlyLimit) {
        return true;
      }
    }

    return false;
  }

  private async getSentCount(serverId: string, since: Date): Promise<number> {
    // This would typically query a separate tracking table
    // For now, return 0 as placeholder
    return 0;
  }

  private async updateServerStats(serverId: string, success: boolean): Promise<void> {
    const stats = this.serverStats.get(serverId) || { sent: 0, lastUsed: new Date() };
    stats.sent += 1;
    stats.lastUsed = new Date();
    this.serverStats.set(serverId, stats);
  }

  private async logSendingAttempt(
    tenantId: string,
    serverId: string,
    message: EmailMessage,
    result: SendingResult
  ): Promise<void> {
    // Log to audit table or separate sending log table
    try {
      await prisma.auditLog.create({
        data: {
          tenantId,
          action: 'EMAIL_SEND',
          resource: 'sending_server',
          resourceId: serverId,
          metadata: {
            to: Array.isArray(message.to) ? message.to : [message.to],
            subject: message.subject,
            success: result.success,
            messageId: result.messageId,
            error: result.error,
            provider: result.provider,
          },
        },
      });
    } catch (error) {
      console.error('Failed to log sending attempt:', error);
    }
  }

  async validateServerConfig(
    type: SendingServerType, 
    configuration: any
  ): Promise<boolean> {
    const provider = this.providers.get(type);
    if (!provider) {
      return false;
    }

    return provider.validateConfig(configuration);
  }

  async testServerConnection(serverId: string, tenantId: string): Promise<boolean> {
    const server = await prisma.sendingServer.findFirst({
      where: {
        id: serverId,
        tenantId,
      },
    });

    if (!server) {
      return false;
    }

    return this.validateServerConfig(
      server.type as SendingServerType, 
      server.configuration
    );
  }
}