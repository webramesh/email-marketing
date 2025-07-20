import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { BaseSendingProvider } from './base-provider';
import { EmailMessage, SendingResult, AmazonSESConfig, SendingServerType } from '@/types/email-sending';

export class AmazonSESProvider extends BaseSendingProvider {
  type = SendingServerType.AMAZON_SES;
  
  async send(message: EmailMessage, config: AmazonSESConfig): Promise<SendingResult> {
    try {
      this.validateEmailMessage(message);
      
      const client = new SESClient({
        region: config.region,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });

      const recipients = Array.isArray(message.to) ? message.to : [message.to];
      
      const command = new SendEmailCommand({
        Source: message.fromName ? `${message.fromName} <${message.from}>` : message.from,
        Destination: {
          ToAddresses: recipients,
        },
        Message: {
          Subject: {
            Data: message.subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: message.html ? {
              Data: message.html,
              Charset: 'UTF-8',
            } : undefined,
            Text: message.text ? {
              Data: message.text,
              Charset: 'UTF-8',
            } : undefined,
          },
        },
        ReplyToAddresses: message.replyTo ? [message.replyTo] : undefined,
        ConfigurationSetName: config.configurationSet,
        Tags: message.tags?.map(tag => ({
          Name: 'campaign',
          Value: tag,
        })),
      });

      const result = await client.send(command);
      
      return this.createResult(true, result.MessageId);
    } catch (error) {
      console.error('Amazon SES sending error:', error);
      return this.createResult(false, undefined, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async validateConfig(config: AmazonSESConfig): Promise<boolean> {
    try {
      const client = new SESClient({
        region: config.region,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });

      // Test the connection by getting sending quota
      await client.send(new (await import('@aws-sdk/client-ses')).GetSendQuotaCommand({}));
      return true;
    } catch (error) {
      console.error('Amazon SES config validation error:', error);
      return false;
    }
  }
}