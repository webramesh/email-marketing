import nodemailer from 'nodemailer';
import { BaseSendingProvider } from './base-provider';
import { EmailMessage, SendingResult, SMTPConfig, SendingServerType } from '@/types/email-sending';

export class SMTPProvider extends BaseSendingProvider {
  type = SendingServerType.SMTP;

  async send(message: EmailMessage, config: SMTPConfig): Promise<SendingResult> {
    try {
      this.validateEmailMessage(message);

      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.username,
          pass: config.password,
        },
        pool: config.pool,
        maxConnections: config.maxConnections,
        maxMessages: config.maxMessages,
      } as any);

      const recipients = Array.isArray(message.to) ? message.to : [message.to];

      const mailOptions = {
        from: message.fromName ? `${message.fromName} <${message.from}>` : message.from,
        to: recipients,
        replyTo: message.replyTo,
        subject: message.subject,
        html: message.html,
        text: message.text,
        attachments: message.attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
          cid: att.cid,
        })),
        headers: message.headers,
      };

      const result = await transporter.sendMail(mailOptions);

      return this.createResult(true, result.messageId);
    } catch (error: any) {
      console.error('SMTP sending error:', error);
      return this.createResult(false, undefined, error.message || 'Unknown error');
    }
  }

  async validateConfig(config: SMTPConfig): Promise<boolean> {
    try {
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.username,
          pass: config.password,
        },
      });

      await transporter.verify();
      return true;
    } catch (error) {
      console.error('SMTP config validation error:', error);
      return false;
    }
  }
}
