import { BaseSendingProvider } from './base-provider';
import { EmailMessage, SendingResult, SparkPostConfig, SendingServerType } from '@/types/email-sending';

export class SparkPostProvider extends BaseSendingProvider {
  type = SendingServerType.SPARKPOST;
  
  async send(message: EmailMessage, config: SparkPostConfig): Promise<SendingResult> {
    try {
      this.validateEmailMessage(message);
      
      const baseUrl = config.baseUrl || 'https://api.sparkpost.com';
      const recipients = Array.isArray(message.to) ? message.to : [message.to];
      
      const transmissionData = {
        options: {
          ip_pool: config.ipPool,
        },
        content: {
          from: {
            email: message.from,
            name: message.fromName,
          },
          reply_to: message.replyTo,
          subject: message.subject,
          html: message.html,
          text: message.text,
          headers: message.headers,
          attachments: message.attachments?.map(att => ({
            name: att.filename,
            type: att.contentType || 'application/octet-stream',
            data: typeof att.content === 'string' ? att.content : att.content.toString('base64'),
          })),
        },
        recipients: recipients.map(email => ({ address: email })),
        metadata: message.metadata,
        tags: message.tags,
      };

      const response = await fetch(`${baseUrl}/api/v1/transmissions`, {
        method: 'POST',
        headers: {
          'Authorization': config.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transmissionData),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.errors?.[0]?.message || 'SparkPost API error');
      }
      
      return this.createResult(true, result.results?.id);
    } catch (error: any) {
      console.error('SparkPost sending error:', error);
      return this.createResult(false, undefined, error.message || 'Unknown error');
    }
  }

  async validateConfig(config: SparkPostConfig): Promise<boolean> {
    try {
      const baseUrl = config.baseUrl || 'https://api.sparkpost.com';
      
      const response = await fetch(`${baseUrl}/api/v1/account`, {
        method: 'GET',
        headers: {
          'Authorization': config.apiKey,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('SparkPost config validation error:', error);
      return false;
    }
  }
}