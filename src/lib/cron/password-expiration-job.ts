import { PasswordSecurityService } from '@/services/password-security.service';

/**
 * Scheduled job to send password expiration notifications
 * This should be run daily via a cron job or scheduled task
 */
export async function runPasswordExpirationJob(): Promise<void> {
  console.log('Starting password expiration notification job...');
  
  try {
    await PasswordSecurityService.schedulePasswordExpirationNotifications();
    console.log('Password expiration notification job completed successfully');
  } catch (error) {
    console.error('Password expiration notification job failed:', error);
    throw error;
  }
}

/**
 * API endpoint handler for manual execution of the job
 */
export async function handlePasswordExpirationJobRequest(): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  try {
    await runPasswordExpirationJob();
    return {
      success: true,
      message: 'Password expiration notifications scheduled successfully',
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to schedule password expiration notifications',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// If running this file directly (for cron jobs)
if (require.main === module) {
  runPasswordExpirationJob()
    .then(() => {
      console.log('Job completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Job failed:', error);
      process.exit(1);
    });
}