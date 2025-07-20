import sgMail from '@sendgrid/mail';
import { BaseSendingProvider } from './base-provider';
import { EmailMessage, SendingResult, SendGridConfig, SendingServerType } from '@/types/email-sending';

export class SendGridProvider extends BaseSendingProvider {
  type = SendingServerType.SENDGRID;
  
  async send(message: EmailMessage, config: SendGridConfig): Promise<SendingResult> {
    try {
      this.validateEmailMessage(message);
      
      sgMail.setApiKey(config.apiKey);

      const recipients = Array.isArray(message.to) ? message.to : [message.to];
      
      const mailData = {
        to: recipients,
        from: {
          email: message.from,
          name: message.fromName,
        },
        replyTo: message.replyTo,
        subject: message.subject,
        html: message.html,
        text: message.text,
        attachments: message.attachments?.map(att => ({
          filename: att.filename,
          content: typeof att.content === 'string' ? att.content : att.content.toString('base64'),
          type: att.contentType,
          disposition: 'attachment',
          contentId: att.cid,
        })),
        customArgs: message.metadata,
        ipPoolName: config.ipPoolName,
        headers: message.headers,
      };

      const result = await sgMail.send(mailData);
      
      return this.createResult(true, result[0]?.headers?.['x-message-id'] || 'sent');
    } catch (error: any) {
      console.error('SendGrid sending error:', error);
      const errorMessage = error?.response?.body?.errors?.[0]?.message || error.message || 'Unknown error';
      return this.createResult(false, undefined, errorMessage);
    }
  }

  async validateConfig(config: SendGridConfig): Promise<boolean> {
    try {
      sgMail.setApiKey(config.apiKey);
      
      // Test the API key by making a simple request
      const request = {
        method: 'GET' as const,
        url: '/v3/user/profile',
      };
      
      await sgMail.request(request);
      return true;
    } catch (error) {
      console.error('SendGrid config validation error:', error);
      return false;
    }
  }
}