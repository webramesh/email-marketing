import { BaseSendingProvider } from './base-provider';
import { EmailMessage, SendingResult, PostalConfig, SendingServerType } from '@/types/email-sending';

export class PostalProvider extends BaseSendingProvider {
  type = SendingServerType.POSTAL;
  
  async send(message: EmailMessage, config: PostalConfig): Promise<SendingResult> {
    try {
      this.validateEmailMessage(message);
      
      const protocol = config.secure !== false ? 'https' : 'http';
      const baseUrl = `${protocol}://${config.host}`;
      const recipients = Array.isArray(message.to) ? message.to : [message.to];
      
      const emailData = {
        to: recipients,
        from: message.from,
        sender: message.fromName ? `${message.fromName} <${message.from}>` : message.from,
        reply_to: message.replyTo,
        subject: message.subject,
        html_body: message.html,
        plain_body: message.text,
        attachments: message.attachments?.map(att => ({
          name: att.filename,
          content_type: att.contentType || 'application/octet-stream',
          data: typeof att.content === 'string' ? att.content : att.content.toString('base64'),
        })),
        headers: message.headers,
        tag: message.tags?.[0], // Postal supports single tag
      };

      const response = await fetch(`${baseUrl}/api/v1/send/message`, {
        method: 'POST',
        headers: {
          'X-Server-API-Key': config.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Postal API error');
      }
      
      return this.createResult(true, result.message_id);
    } catch (error: any) {
      console.error('Postal sending error:', error);
      return this.createResult(false, undefined, error.message || 'Unknown error');
    }
  }

  async validateConfig(config: PostalConfig): Promise<boolean> {
    try {
      const protocol = config.secure !== false ? 'https' : 'http';
      const baseUrl = `${protocol}://${config.host}`;
      
      const response = await fetch(`${baseUrl}/api/v1/servers`, {
        method: 'GET',
        headers: {
          'X-Server-API-Key': config.apiKey,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Postal config validation error:', error);
      return false;
    }
  }
}