import { EmailMessage, SendingResult, SendingServerConfiguration, SendingProvider } from '@/types/email-sending';

export abstract class BaseSendingProvider implements SendingProvider {
  abstract type: any;
  
  abstract send(message: EmailMessage, config: SendingServerConfiguration): Promise<SendingResult>;
  
  abstract validateConfig(config: SendingServerConfiguration): Promise<boolean>;
  
  protected createResult(success: boolean, messageId?: string, error?: string): SendingResult {
    return {
      success,
      messageId,
      error,
      provider: this.type,
      timestamp: new Date()
    };
  }
  
  protected sanitizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
  
  protected validateEmailMessage(message: EmailMessage): void {
    if (!message.to || (Array.isArray(message.to) && message.to.length === 0)) {
      throw new Error('Recipient email is required');
    }
    
    if (!message.from) {
      throw new Error('Sender email is required');
    }
    
    if (!message.subject) {
      throw new Error('Email subject is required');
    }
    
    if (!message.html && !message.text) {
      throw new Error('Email content (HTML or text) is required');
    }
  }
}