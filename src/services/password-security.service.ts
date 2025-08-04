import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PasswordResetMethod } from '@/generated/prisma';

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventCommonPasswords: boolean;
  preventPersonalInfo: boolean;
  historyCount: number; // Number of previous passwords to check
  expirationDays?: number; // Password expiration in days
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
}

export interface PasswordStrengthResult {
  score: number; // 0-100
  isValid: boolean;
  feedback: string[];
  warnings: string[];
}

export interface PasswordResetRequest {
  userId: string;
  method: PasswordResetMethod;
  verificationData?: any;
  ipAddress?: string;
  userAgent?: string;
}

export interface PasswordResetVerification {
  token: string;
  newPassword: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Password Security Service
 * Handles advanced password policies, history tracking, reset functionality, and breach detection
 */
export class PasswordSecurityService {
  // Default password policy
  private static readonly DEFAULT_POLICY: PasswordPolicy = {
    minLength: 12,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    preventCommonPasswords: true,
    preventPersonalInfo: true,
    historyCount: 12, // Remember last 12 passwords
    expirationDays: 90, // Expire passwords after 90 days
    maxFailedAttempts: 5,
    lockoutDurationMinutes: 30,
  };

  // Common passwords list (subset for demonstration)
  private static readonly COMMON_PASSWORDS = new Set([
    'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
    'admin', 'letmein', 'welcome', 'monkey', '1234567890', 'password1',
    'qwerty123', 'welcome123', 'admin123', 'root', 'toor', 'pass',
    'test', 'guest', 'user', 'demo', 'sample', 'temp', 'temporary'
  ]);

  // Compromised password hashes (in production, this would be a larger database)
  private static readonly COMPROMISED_HASHES = new Set<string>();

  /**
   * Get password policy for tenant (can be customized per tenant)
   */
  static async getPasswordPolicy(tenantId: string): Promise<PasswordPolicy> {
    // In the future, this could be customized per tenant
    // For now, return the default policy
    return this.DEFAULT_POLICY;
  }

  /**
   * Validate password strength against policy
   */
  static async validatePasswordStrength(
    password: string,
    userInfo?: { email?: string; name?: string; firstName?: string; lastName?: string },
    tenantId?: string
  ): Promise<PasswordStrengthResult> {
    const policy = tenantId ? await this.getPasswordPolicy(tenantId) : this.DEFAULT_POLICY;
    const feedback: string[] = [];
    const warnings: string[] = [];
    let score = 0;

    // Length check
    if (password.length < policy.minLength) {
      feedback.push(`Password must be at least ${policy.minLength} characters long`);
    } else if (password.length >= policy.minLength) {
      score += 20;
    }

    if (password.length > policy.maxLength) {
      feedback.push(`Password must not exceed ${policy.maxLength} characters`);
    }

    // Character requirements
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      feedback.push('Password must contain at least one uppercase letter');
    } else if (policy.requireUppercase) {
      score += 15;
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      feedback.push('Password must contain at least one lowercase letter');
    } else if (policy.requireLowercase) {
      score += 15;
    }

    if (policy.requireNumbers && !/\d/.test(password)) {
      feedback.push('Password must contain at least one number');
    } else if (policy.requireNumbers) {
      score += 15;
    }

    if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      feedback.push('Password must contain at least one special character');
    } else if (policy.requireSpecialChars) {
      score += 15;
    }

    // Common password check
    if (policy.preventCommonPasswords && this.COMMON_PASSWORDS.has(password.toLowerCase())) {
      feedback.push('Password is too common. Please choose a more unique password');
      score = Math.max(0, score - 30);
    }

    // Personal information check
    if (policy.preventPersonalInfo && userInfo) {
      const personalInfo = [
        userInfo.email?.split('@')[0],
        userInfo.name,
        userInfo.firstName,
        userInfo.lastName
      ].filter(Boolean).map(info => info!.toLowerCase());

      for (const info of personalInfo) {
        if (password.toLowerCase().includes(info)) {
          feedback.push('Password should not contain personal information');
          score = Math.max(0, score - 20);
          break;
        }
      }
    }

    // Additional strength checks
    const hasRepeatingChars = /(.)\1{2,}/.test(password);
    if (hasRepeatingChars) {
      warnings.push('Avoid repeating characters');
      score = Math.max(0, score - 10);
    }

    const hasSequentialChars = this.hasSequentialCharacters(password);
    if (hasSequentialChars) {
      warnings.push('Avoid sequential characters');
      score = Math.max(0, score - 10);
    }

    // Bonus points for length and complexity
    if (password.length >= 16) score += 10;
    if (password.length >= 20) score += 10;

    const uniqueChars = new Set(password).size;
    if (uniqueChars >= password.length * 0.7) score += 10;

    score = Math.min(100, Math.max(0, score));

    return {
      score,
      isValid: feedback.length === 0,
      feedback,
      warnings
    };
  }

  /**
   * Check if password contains sequential characters
   */
  private static hasSequentialCharacters(password: string): boolean {
    const sequences = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
    
    for (const sequence of sequences) {
      for (let i = 0; i <= sequence.length - 3; i++) {
        const subseq = sequence.substring(i, i + 3);
        if (password.toLowerCase().includes(subseq) || password.toLowerCase().includes(subseq.split('').reverse().join(''))) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if password has been compromised in known breaches
   */
  static async checkPasswordBreach(password: string): Promise<boolean> {
    // In production, this would check against HaveIBeenPwned API or similar
    // For now, check against our local compromised hashes
    const hash = crypto.createHash('sha1').update(password).digest('hex').toLowerCase();
    return this.COMPROMISED_HASHES.has(hash);
  }

  /**
   * Check password against history to prevent reuse
   */
  static async checkPasswordHistory(userId: string, newPassword: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { tenantId: true }
      });

      if (!user) return false;

      const policy = await this.getPasswordPolicy(user.tenantId);
      
      const passwordHistory = await prisma.passwordHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: policy.historyCount,
        select: { passwordHash: true }
      });

      // Check against current password and history
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { password: true }
      });

      if (currentUser && await bcrypt.compare(newPassword, currentUser.password)) {
        return true; // Password matches current password
      }

      // Check against password history
      for (const historyEntry of passwordHistory) {
        if (await bcrypt.compare(newPassword, historyEntry.passwordHash)) {
          return true; // Password found in history
        }
      }

      return false; // Password not found in history
    } catch (error) {
      console.error('Error checking password history:', error);
      return false;
    }
  }

  /**
   * Change password with security checks
   */
  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    context: { ipAddress?: string; userAgent?: string; changedBy?: string }
  ): Promise<{ success: boolean; error?: string; warnings?: string[] }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { 
          password: true, 
          tenantId: true, 
          email: true, 
          name: true, 
          firstName: true, 
          lastName: true,
          isCompromised: true,
          mustChangePassword: true
        }
      });

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Verify current password (unless it's a forced change)
      if (!user.mustChangePassword) {
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
          return { success: false, error: 'Current password is incorrect' };
        }
      }

      // Validate new password strength
      const strengthResult = await this.validatePasswordStrength(
        newPassword,
        { 
          email: user.email, 
          name: user.name || undefined, 
          firstName: user.firstName || undefined, 
          lastName: user.lastName || undefined 
        },
        user.tenantId
      );

      if (!strengthResult.isValid) {
        return { 
          success: false, 
          error: 'Password does not meet security requirements',
          warnings: strengthResult.feedback 
        };
      }

      // Check password history
      const isPasswordReused = await this.checkPasswordHistory(userId, newPassword);
      if (isPasswordReused) {
        return { 
          success: false, 
          error: 'Password has been used recently. Please choose a different password.' 
        };
      }

      // Check for compromised password
      const isCompromised = await this.checkPasswordBreach(newPassword);
      if (isCompromised) {
        return { 
          success: false, 
          error: 'This password has been found in data breaches. Please choose a different password.' 
        };
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 12);

      // Calculate password expiration
      const policy = await this.getPasswordPolicy(user.tenantId);
      const passwordExpiresAt = policy.expirationDays 
        ? new Date(Date.now() + policy.expirationDays * 24 * 60 * 60 * 1000)
        : null;

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedNewPassword,
          passwordChangedAt: new Date(),
          passwordExpiresAt,
          mustChangePassword: false,
          isCompromised: false,
          compromisedAt: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        },
      });

      // Store old password in history
      await prisma.passwordHistory.create({
        data: {
          userId,
          passwordHash: user.password,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });

      // Clean up old password history beyond policy limit
      const policy2 = await this.getPasswordPolicy(user.tenantId);
      const oldHistory = await prisma.passwordHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: policy2.historyCount,
        select: { id: true }
      });

      if (oldHistory.length > 0) {
        await prisma.passwordHistory.deleteMany({
          where: {
            id: { in: oldHistory.map(h => h.id) }
          }
        });
      }

      return { 
        success: true, 
        warnings: strengthResult.warnings.length > 0 ? strengthResult.warnings : undefined 
      };
    } catch (error) {
      console.error('Error changing password:', error);
      return { success: false, error: 'Failed to change password' };
    }
  }

  /**
   * Create password reset token
   */
  static async createPasswordResetToken(request: PasswordResetRequest): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
      // Generate secure token
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
      // Token expires in 1 hour
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      // Invalidate any existing tokens for this user
      await prisma.passwordResetToken.updateMany({
        where: { 
          userId: request.userId,
          isUsed: false,
          expiresAt: { gt: new Date() }
        },
        data: { isUsed: true, usedAt: new Date() }
      });

      // Create new token
      await prisma.passwordResetToken.create({
        data: {
          userId: request.userId,
          token,
          tokenHash,
          expiresAt,
          verificationMethod: request.method,
          verificationData: request.verificationData,
          ipAddress: request.ipAddress,
          userAgent: request.userAgent,
        },
      });

      return { success: true, token };
    } catch (error) {
      console.error('Error creating password reset token:', error);
      return { success: false, error: 'Failed to create reset token' };
    }
  }

  /**
   * Verify and use password reset token
   */
  static async resetPasswordWithToken(verification: PasswordResetVerification): Promise<{ success: boolean; error?: string; warnings?: string[] }> {
    try {
      const tokenHash = crypto.createHash('sha256').update(verification.token).digest('hex');
      
      const resetToken = await prisma.passwordResetToken.findUnique({
        where: { tokenHash },
        include: { user: true }
      });

      if (!resetToken) {
        return { success: false, error: 'Invalid reset token' };
      }

      if (resetToken.isUsed) {
        return { success: false, error: 'Reset token has already been used' };
      }

      if (resetToken.expiresAt < new Date()) {
        return { success: false, error: 'Reset token has expired' };
      }

      // Validate new password
      const strengthResult = await this.validatePasswordStrength(
        verification.newPassword,
        { 
          email: resetToken.user.email, 
          name: resetToken.user.name || undefined, 
          firstName: resetToken.user.firstName || undefined, 
          lastName: resetToken.user.lastName || undefined 
        },
        resetToken.user.tenantId
      );

      if (!strengthResult.isValid) {
        return { 
          success: false, 
          error: 'Password does not meet security requirements',
          warnings: strengthResult.feedback 
        };
      }

      // Check password history
      const isPasswordReused = await this.checkPasswordHistory(resetToken.userId, verification.newPassword);
      if (isPasswordReused) {
        return { 
          success: false, 
          error: 'Password has been used recently. Please choose a different password.' 
        };
      }

      // Check for compromised password
      const isCompromised = await this.checkPasswordBreach(verification.newPassword);
      if (isCompromised) {
        return { 
          success: false, 
          error: 'This password has been found in data breaches. Please choose a different password.' 
        };
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(verification.newPassword, 12);

      // Calculate password expiration
      const policy = await this.getPasswordPolicy(resetToken.user.tenantId);
      const passwordExpiresAt = policy.expirationDays 
        ? new Date(Date.now() + policy.expirationDays * 24 * 60 * 60 * 1000)
        : null;

      // Update password and mark token as used
      await prisma.$transaction([
        prisma.user.update({
          where: { id: resetToken.userId },
          data: {
            password: hashedNewPassword,
            passwordChangedAt: new Date(),
            passwordExpiresAt,
            mustChangePassword: false,
            isCompromised: false,
            compromisedAt: null,
            failedLoginAttempts: 0,
            lockedUntil: null,
            updatedAt: new Date(),
          },
        }),
        prisma.passwordResetToken.update({
          where: { id: resetToken.id },
          data: {
            isUsed: true,
            usedAt: new Date(),
          },
        }),
        prisma.passwordHistory.create({
          data: {
            userId: resetToken.userId,
            passwordHash: resetToken.user.password,
            ipAddress: verification.ipAddress,
            userAgent: verification.userAgent,
          },
        }),
      ]);

      return { 
        success: true, 
        warnings: strengthResult.warnings.length > 0 ? strengthResult.warnings : undefined 
      };
    } catch (error) {
      console.error('Error resetting password:', error);
      return { success: false, error: 'Failed to reset password' };
    }
  }

  /**
   * Check if user account is locked due to failed login attempts
   */
  static async isAccountLocked(userId: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { lockedUntil: true }
      });

      if (!user || !user.lockedUntil) return false;
      
      return user.lockedUntil > new Date();
    } catch (error) {
      console.error('Error checking account lock status:', error);
      return false;
    }
  }

  /**
   * Handle failed login attempt
   */
  static async handleFailedLogin(userId: string): Promise<{ isLocked: boolean; attemptsRemaining: number }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { failedLoginAttempts: true, tenantId: true }
      });

      if (!user) return { isLocked: false, attemptsRemaining: 0 };

      const policy = await this.getPasswordPolicy(user.tenantId);
      const newAttempts = user.failedLoginAttempts + 1;
      
      let updateData: any = {
        failedLoginAttempts: newAttempts,
        updatedAt: new Date(),
      };

      let isLocked = false;
      if (newAttempts >= policy.maxFailedAttempts) {
        const lockoutDuration = policy.lockoutDurationMinutes * 60 * 1000;
        updateData.lockedUntil = new Date(Date.now() + lockoutDuration);
        isLocked = true;
      }

      await prisma.user.update({
        where: { id: userId },
        data: updateData,
      });

      const attemptsRemaining = Math.max(0, policy.maxFailedAttempts - newAttempts);
      
      return { isLocked, attemptsRemaining };
    } catch (error) {
      console.error('Error handling failed login:', error);
      return { isLocked: false, attemptsRemaining: 0 };
    }
  }

  /**
   * Reset failed login attempts on successful login
   */
  static async resetFailedLoginAttempts(userId: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Error resetting failed login attempts:', error);
    }
  }

  /**
   * Check if password is expired
   */
  static async isPasswordExpired(userId: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordExpiresAt: true, mustChangePassword: true }
      });

      if (!user) return false;
      
      if (user.mustChangePassword) return true;
      if (!user.passwordExpiresAt) return false;
      
      return user.passwordExpiresAt < new Date();
    } catch (error) {
      console.error('Error checking password expiration:', error);
      return false;
    }
  }

  /**
   * Mark password as compromised
   */
  static async markPasswordAsCompromised(userId: string, reason?: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          isCompromised: true,
          compromisedAt: new Date(),
          mustChangePassword: true,
          updatedAt: new Date(),
        },
      });

      // Log security event
      await prisma.securityEvent.create({
        data: {
          userId,
          eventType: 'PASSWORD_RESET_REQUEST',
          severity: 'HIGH',
          description: `Password marked as compromised: ${reason || 'Unknown reason'}`,
          metadata: { reason },
        },
      });
    } catch (error) {
      console.error('Error marking password as compromised:', error);
    }
  }

  /**
   * Get password security status for user
   */
  static async getPasswordSecurityStatus(userId: string): Promise<{
    isExpired: boolean;
    isCompromised: boolean;
    mustChange: boolean;
    daysUntilExpiration?: number;
    lastChanged?: Date;
    strength?: PasswordStrengthResult;
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          passwordExpiresAt: true,
          passwordChangedAt: true,
          isCompromised: true,
          mustChangePassword: true,
          email: true,
          name: true,
          firstName: true,
          lastName: true,
          tenantId: true
        }
      });

      if (!user) {
        return {
          isExpired: false,
          isCompromised: false,
          mustChange: false
        };
      }

      const isExpired = user.passwordExpiresAt ? user.passwordExpiresAt < new Date() : false;
      const daysUntilExpiration = user.passwordExpiresAt 
        ? Math.ceil((user.passwordExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : undefined;

      return {
        isExpired,
        isCompromised: user.isCompromised,
        mustChange: user.mustChangePassword || isExpired,
        daysUntilExpiration,
        lastChanged: user.passwordChangedAt || undefined,
      };
    } catch (error) {
      console.error('Error getting password security status:', error);
      return {
        isExpired: false,
        isCompromised: false,
        mustChange: false
      };
    }
  }
}