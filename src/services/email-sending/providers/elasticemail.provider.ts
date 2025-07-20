import { BaseSendingProvider } from './base-provider';
import { EmailMessage, SendingResult, ElasticEmailConfig, SendingServerType } from '@/types/email-sending';

export class ElasticEmailProvider extends BaseSendingProvider {
  type = SendingServerType.ELASTICEMAIL;
  
  async send(message: EmailMessage, config: ElasticEmailConfig): Promise<SendingResult> {
    try {
      this.validateEmailMessage(message);
      
      const baseUrl = config.baseUrl || 'https://api.elasticemail.com';
      const recipients = Array.isArray(message.to) ? message.to : [message.to];
      
      const formData = new URLSearchParams();
      formData.append('apikey', config.apiKey);
      formData.append('from', message.from);
      formData.append('fromName', message.fromName || '');
      formData.append('to', recipients.join(','));
      formData.append('subject', message.subject);
      formData.append('bodyHtml', message.html || '');
      formData.append('bodyText', message.text || '');
      
      if (message.replyTo) {
        formData.append('replyTo', message.replyTo);
      }
      
      if (message.headers) {
        Object.entries(message.headers).forEach(([key, value]) => {
          formData.append(`headers_${key}`, value);
        });
      }

      const response = await fetch(`${baseUrl}/v2/email/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'ElasticEmail API error');
      }
      
      return this.createResult(true, result.data?.messageid);
    } catch (error: any) {
      console.error('ElasticEmail sending error:', error);
      return this.createResult(false, undefined, error.message || 'Unknown error');
    }
  }

  async validateConfig(config: ElasticEmailConfig): Promise<boolean> {
    try {
      const baseUrl = config.baseUrl || 'https://api.elasticemail.com';
      
      const formData = new URLSearchParams();
      formData.append('apikey', config.apiKey);

      const response = await fetch(`${baseUrl}/v2/account/load`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      const result = await response.json();
      return response.ok && result.success;
    } catch (error) {
      console.error('ElasticEmail config validation error:', error);
      return false;
    }
  }
}