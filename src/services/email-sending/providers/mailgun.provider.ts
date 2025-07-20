import Mailgun from 'mailgun.js';
import formData from 'form-data';
import { BaseSendingProvider } from './base-provider';
import { EmailMessage, SendingResult, MailgunConfig, SendingServerType } from '@/types/email-sending';

export class MailgunProvider extends BaseSendingProvider {
  type = SendingServerType.MAILGUN;
  
  async send(message: EmailMessage, config: MailgunConfig): Promise<SendingResult> {
    try {
      this.validateEmailMessage(message);
      
      const mailgun = new Mailgun(formData);
      const mg = mailgun.client({
        username: 'api',
        key: config.apiKey,
        url: config.baseUrl || 'https://api.mailgun.net',
      });

      const recipients = Array.isArray(message.to) ? message.to : [message.to];
      
      const mailData = {
        from: message.fromName ? `${message.fromName} <${message.from}>` : message.from,
        to: recipients,
        'h:Reply-To': message.replyTo,
        subject: message.subject,
        html: message.html,
        text: message.text,
        attachment: message.attachments?.map(att => ({
          filename: att.filename,
          data: att.content,
          contentType: att.contentType,
        })),
        'o:tag': message.tags,
        'v:metadata': message.metadata ? JSON.stringify(message.metadata) : undefined,
      };

      // Add custom headers
      if (message.headers) {
        Object.entries(message.headers).forEach(([key, value]) => {
          (mailData as any)[`h:${key}`] = value;
        });
      }

      const result = await mg.messages.create(config.domain, mailData);
      
      return this.createResult(true, result.id);
    } catch (error: any) {
      console.error('Mailgun sending error:', error);
      const errorMessage = error?.message || 'Unknown error';
      return this.createResult(false, undefined, errorMessage);
    }
  }

  async validateConfig(config: MailgunConfig): Promise<boolean> {
    try {
      const mailgun = new Mailgun(formData);
      const mg = mailgun.client({
        username: 'api',
        key: config.apiKey,
        url: config.baseUrl || 'https://api.mailgun.net',
      });

      // Test the API key by getting domain info
      await mg.domains.get(config.domain);
      return true;
    } catch (error) {
      console.error('Mailgun config validation error:', error);
      return false;
    }
  }
}