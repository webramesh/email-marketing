export interface EmailMessage {
  to: string | string[];
  from: string;
  fromName?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
  cid?: string;
}

export interface SendingResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
  timestamp: Date;
}

export interface SendingServerConfig {
  id: string;
  name: string;
  type: SendingServerType;
  isActive: boolean;
  priority: number;
  dailyLimit?: number;
  hourlyLimit?: number;
  configuration: SendingServerConfiguration;
}

export enum SendingServerType {
  AMAZON_SES = 'amazon_ses',
  SENDGRID = 'sendgrid',
  MAILGUN = 'mailgun',
  SPARKPOST = 'sparkpost',
  ELASTICEMAIL = 'elasticemail',
  SMTP = 'smtp',
  POSTAL = 'postal'
}

export type SendingServerConfiguration = 
  | AmazonSESConfig
  | SendGridConfig
  | MailgunConfig
  | SparkPostConfig
  | ElasticEmailConfig
  | SMTPConfig
  | PostalConfig;

export interface AmazonSESConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  configurationSet?: string;
}

export interface SendGridConfig {
  apiKey: string;
  ipPoolName?: string;
}

export interface MailgunConfig {
  apiKey: string;
  domain: string;
  baseUrl?: string; // For EU region
}

export interface SparkPostConfig {
  apiKey: string;
  baseUrl?: string; // For EU region
  ipPool?: string;
}

export interface ElasticEmailConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  pool?: boolean;
  maxConnections?: number;
  maxMessages?: number;
}

export interface PostalConfig {
  host: string;
  apiKey: string;
  secure?: boolean;
}

export interface SendingStats {
  serverId: string;
  totalSent: number;
  totalDelivered: number;
  totalBounced: number;
  totalComplained: number;
  lastUsed: Date;
  dailySent: number;
  hourlySent: number;
}

export interface LoadBalancingStrategy {
  type: 'round_robin' | 'weighted' | 'least_used' | 'failover';
  weights?: Record<string, number>;
}

export interface SendingProvider {
  type: SendingServerType;
  send(message: EmailMessage, config: SendingServerConfiguration): Promise<SendingResult>;
  validateConfig(config: SendingServerConfiguration): Promise<boolean>;
  getStats?(config: SendingServerConfiguration): Promise<any>;
}