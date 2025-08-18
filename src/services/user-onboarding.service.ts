import { prisma } from '@/lib/prisma';
import { UserRole, UserInvitationStatus, EmailVerificationStatus } from '@/generated/prisma';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export interface EmailVerificationData {
    email: string;
    token: string;
    expiresAt: Date;
    userId?: string;
    tenantId: string;
    verificationType: 'REGISTRATION' | 'EMAIL_CHANGE' | 'INVITATION';
    metadata?: Record<string, any>;
}

export interface UserInvitationData {
    email: string;
    role: UserRole;
    tenantId: string;
    invitedBy: string;
    packageId?: string;
    customMessage?: string;
    expiresAt?: Date;
}

export interface OnboardingFlowData {
    userId: string;
    tenantId: string;
    flowType: 'ADMIN_SETUP' | 'CUSTOMER_PACKAGE' | 'USER_REGISTRATION';
    currentStep: number;
    totalSteps: number;
    stepData: Record<string, any>;
    isCompleted: boolean;
}

export interface AdminCompanyVerificationData {
    tenantId: string;
    companyName: string;
    businessType: string;
    contactEmail: string;
    contactPhone?: string;
    businessAddress: Record<string, any>;
    businessDocuments?: string[];
    verificationNotes?: string;
}

/**
 * Multi-Tier User Onboarding Service
 * Handles email verification, user invitations, and onboarding flows
 */
export class UserOnboardingService {

    /**
     * Send email verification for new user registration
     */
    static async sendEmailVerification(
        email: string,
        tenantId: string,
        verificationType: 'REGISTRATION' | 'EMAIL_CHANGE' | 'INVITATION' = 'REGISTRATION',
        userId?: string,
        metadata?: Record<string, any>
    ): Promise<{ token: string; expiresAt: Date }> {
        try {
            // Generate verification token
            const token = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

            // Store verification record
            await prisma.emailVerification.create({
                data: {
                    email: email.toLowerCase().trim(),
                    tokenHash,
                    expiresAt,
                    userId,
                    tenantId,
                    verificationType,
                    status: EmailVerificationStatus.PENDING,
                    metadata: metadata || {},
                },
            });

            // Send verification email (placeholder - integrate with email service)
            await this.sendVerificationEmail(email, token, verificationType, tenantId);

            return { token, expiresAt };
        } catch (error) {
            console.error('Error sending email verification:', error);
            throw new Error('Failed to send email verification');
        }
    }

    /**
     * Verify email with token
     */
    static async verifyEmail(token: string, tenantId: string): Promise<{
        success: boolean;
        userId?: string;
        email?: string;
        verificationType?: string;
        error?: string;
    }> {
        try {
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

            const verification = await prisma.emailVerification.findFirst({
                where: {
                    tokenHash,
                    tenantId,
                    status: EmailVerificationStatus.PENDING,
                    expiresAt: { gt: new Date() },
                },
            });

            if (!verification) {
                return {
                    success: false,
                    error: 'Invalid or expired verification token',
                };
            }

            // Mark as verified
            await prisma.emailVerification.update({
                where: { id: verification.id },
                data: {
                    status: EmailVerificationStatus.VERIFIED,
                    verifiedAt: new Date(),
                },
            });

            // If user exists, mark email as verified
            if (verification.userId) {
                await prisma.user.update({
                    where: { id: verification.userId },
                    data: { emailVerified: true },
                });
            }

            return {
                success: true,
                userId: verification.userId || undefined,
                email: verification.email,
                verificationType: verification.verificationType || undefined,
            };
        } catch (error) {
            console.error('Error verifying email:', error);
            return {
                success: false,
                error: 'Failed to verify email',
            };
        }
    }

    /**
     * Create user invitation with role and package pre-assignment
     */
    static async createUserInvitation(data: UserInvitationData): Promise<{
        invitationId: string;
        token: string;
        expiresAt: Date;
    }> {
        try {
            const token = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            const expiresAt = data.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

            const invitation = await prisma.userInvitation.create({
                data: {
                    email: data.email.toLowerCase().trim(),
                    role: data.role,
                    tenantId: data.tenantId,
                    invitedBy: data.invitedBy,
                    packageId: data.packageId,
                    customMessage: data.customMessage,
                    tokenHash,
                    expiresAt,
                    status: UserInvitationStatus.PENDING,
                },
            });

            // Send invitation email
            await this.sendInvitationEmail(
                data.email,
                token,
                data.role,
                data.tenantId,
                data.customMessage
            );

            return {
                invitationId: invitation.id,
                token,
                expiresAt,
            };
        } catch (error) {
            console.error('Error creating user invitation:', error);
            throw new Error('Failed to create user invitation');
        }
    }

    /**
     * Accept user invitation and create account
     */
    static async acceptInvitation(
        token: string,
        userData: {
            name?: string;
            firstName?: string;
            lastName?: string;
            password: string;
        }
    ): Promise<{
        success: boolean;
        userId?: string;
        tenantId?: string;
        packageId?: string;
        error?: string;
    }> {
        try {
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

            const invitation = await prisma.userInvitation.findFirst({
                where: {
                    tokenHash,
                    status: UserInvitationStatus.PENDING,
                    expiresAt: { gt: new Date() },
                },
                include: {
                    tenant: true,
                },
            });

            if (!invitation) {
                return {
                    success: false,
                    error: 'Invalid or expired invitation',
                };
            }

            // Check if user already exists
            const existingUser = await prisma.user.findUnique({
                where: {
                    email_tenantId: {
                        email: invitation.email,
                        tenantId: invitation.tenantId,
                    },
                },
            });

            if (existingUser) {
                return {
                    success: false,
                    error: 'User already exists in this tenant',
                };
            }

            // Hash password
            const hashedPassword = bcrypt.hashSync(userData.password, 12);

            // Create user account
            const user = await prisma.user.create({
                data: {
                    email: invitation.email,
                    name: userData.name,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    password: hashedPassword,
                    role: invitation.role,
                    tenantId: invitation.tenantId,
                    emailVerified: true, // Email is pre-verified through invitation
                    isActive: true,
                },
            });

            // Mark invitation as accepted
            await prisma.userInvitation.update({
                where: { id: invitation.id },
                data: {
                    status: UserInvitationStatus.ACCEPTED,
                    acceptedAt: new Date(),
                    acceptedBy: user.id,
                },
            });

            // If package is assigned, create package purchase
            if (invitation.packageId) {
                await this.assignPackageToUser(user.id, invitation.packageId, invitation.tenantId);
            }

            // Start onboarding flow
            await this.startOnboardingFlow(user.id, invitation.tenantId, 'USER_REGISTRATION');

            return {
                success: true,
                userId: user.id,
                tenantId: invitation.tenantId,
                packageId: invitation.packageId || undefined,
            };
        } catch (error) {
            console.error('Error accepting invitation:', error);
            return {
                success: false,
                error: 'Failed to accept invitation',
            };
        }
    }

    /**
     * Start guided onboarding flow
     */
    static async startOnboardingFlow(
        userId: string,
        tenantId: string,
        flowType: 'ADMIN_SETUP' | 'CUSTOMER_PACKAGE' | 'USER_REGISTRATION'
    ): Promise<{ onboardingId: string; currentStep: number; totalSteps: number }> {
        try {
            const stepConfigs = this.getOnboardingSteps(flowType);

            const onboarding = await prisma.userOnboarding.create({
                data: {
                    userId,
                    tenantId,
                    flowType,
                    currentStep: 1,
                    totalSteps: stepConfigs.length,
                    stepData: {},
                    isCompleted: false,
                },
            });

            return {
                onboardingId: onboarding.id,
                currentStep: 1,
                totalSteps: stepConfigs.length,
            };
        } catch (error) {
            console.error('Error starting onboarding flow:', error);
            throw new Error('Failed to start onboarding flow');
        }
    }

    /**
     * Update onboarding step
     */
    static async updateOnboardingStep(
        onboardingId: string,
        stepData: Record<string, any>,
        moveToNext: boolean = true
    ): Promise<{
        success: boolean;
        currentStep: number;
        isCompleted: boolean;
        error?: string;
    }> {
        try {
            const onboarding = await prisma.userOnboarding.findUnique({
                where: { id: onboardingId },
            });

            if (!onboarding) {
                return {
                    success: false,
                    currentStep: 0,
                    isCompleted: false,
                    error: 'Onboarding flow not found',
                };
            }

            const currentStepData = { ...(onboarding.stepData as Record<string, any>), ...stepData };
            const nextStep = moveToNext ? onboarding.currentStep + 1 : onboarding.currentStep;
            const isCompleted = nextStep > onboarding.totalSteps;

            await prisma.userOnboarding.update({
                where: { id: onboardingId },
                data: {
                    currentStep: isCompleted ? onboarding.totalSteps : nextStep,
                    stepData: currentStepData,
                    isCompleted,
                    completedAt: isCompleted ? new Date() : null,
                },
            });

            return {
                success: true,
                currentStep: isCompleted ? onboarding.totalSteps : nextStep,
                isCompleted,
            };
        } catch (error) {
            console.error('Error updating onboarding step:', error);
            return {
                success: false,
                currentStep: 0,
                isCompleted: false,
                error: 'Failed to update onboarding step',
            };
        }
    }

    /**
     * Submit admin company for verification
     */
    static async submitAdminCompanyVerification(
        data: AdminCompanyVerificationData
    ): Promise<{ verificationId: string }> {
        try {
            const verification = await prisma.adminCompanyVerification.create({
                data: {
                    tenantId: data.tenantId,
                    companyName: data.companyName,
                    businessType: data.businessType,
                    contactEmail: data.contactEmail,
                    contactPhone: data.contactPhone,
                    businessAddress: data.businessAddress,
                    businessDocuments: data.businessDocuments || [],
                    verificationNotes: data.verificationNotes,
                    status: 'PENDING',
                    submittedAt: new Date(),
                },
            });

            // Notify superadmins about new verification request
            await this.notifySuperadminsForVerification(verification.id);

            return { verificationId: verification.id };
        } catch (error) {
            console.error('Error submitting admin company verification:', error);
            throw new Error('Failed to submit verification request');
        }
    }

    /**
     * Approve or reject admin company verification (superadmin only)
     */
    static async processAdminCompanyVerification(
        verificationId: string,
        decision: 'APPROVED' | 'REJECTED',
        reviewedBy: string,
        reviewNotes?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const verification = await prisma.adminCompanyVerification.findUnique({
                where: { id: verificationId },
                include: { tenant: true },
            });

            if (!verification) {
                return {
                    success: false,
                    error: 'Verification request not found',
                };
            }

            // Update verification status
            await prisma.adminCompanyVerification.update({
                where: { id: verificationId },
                data: {
                    status: decision,
                    reviewedBy,
                    reviewedAt: new Date(),
                    reviewNotes,
                },
            });

            // If approved, update tenant status and notify admin
            if (decision === 'APPROVED') {
                await prisma.tenant.update({
                    where: { id: verification.tenantId },
                    data: { isVerified: true },
                });

                // Start admin onboarding flow
                const adminUser = await prisma.user.findFirst({
                    where: {
                        tenantId: verification.tenantId,
                        role: UserRole.ADMIN,
                    },
                });

                if (adminUser) {
                    await this.startOnboardingFlow(adminUser.id, verification.tenantId, 'ADMIN_SETUP');
                }
            }

            // Send notification email to admin
            await this.sendVerificationResultEmail(
                verification.contactEmail,
                decision,
                verification.companyName,
                reviewNotes
            );

            return { success: true };
        } catch (error) {
            console.error('Error processing admin company verification:', error);
            return {
                success: false,
                error: 'Failed to process verification',
            };
        }
    }

    /**
     * Assign package to user after purchase
     */
    private static async assignPackageToUser(
        userId: string,
        packageId: string,
        tenantId: string
    ): Promise<void> {
        try {
            const packageData = await prisma.package.findUnique({
                where: { id: packageId },
            });

            if (!packageData) {
                throw new Error('Package not found');
            }

            const now = new Date();
            const nextMonth = new Date(now);
            nextMonth.setMonth(nextMonth.getMonth() + 1);

            await prisma.packagePurchase.create({
                data: {
                    packageId,
                    customerId: userId,
                    purchasePrice: packageData.price,
                    currency: packageData.currency,
                    billingCycle: packageData.billingCycle,
                    status: 'ACTIVE',
                    currentPeriodStart: now,
                    currentPeriodEnd: nextMonth,
                    quotas: packageData.quotas as any,
                    usage: {},
                },
            });
        } catch (error) {
            console.error('Error assigning package to user:', error);
            throw error;
        }
    }

    /**
     * Get onboarding steps configuration
     */
    private static getOnboardingSteps(flowType: string): Array<{ id: string; title: string; description: string }> {
        switch (flowType) {
            case 'ADMIN_SETUP':
                return [
                    { id: 'company_info', title: 'Company Information', description: 'Set up your company profile' },
                    { id: 'package_creation', title: 'Create Your First Package', description: 'Create a package to sell to customers' },
                    { id: 'payment_setup', title: 'Payment Configuration', description: 'Configure payment methods' },
                    { id: 'email_setup', title: 'Email Configuration', description: 'Set up email sending and domains' },
                    { id: 'team_setup', title: 'Team Members', description: 'Invite team members to your account' },
                ];
            case 'CUSTOMER_PACKAGE':
                return [
                    { id: 'package_activation', title: 'Package Activation', description: 'Activate your purchased package' },
                    { id: 'profile_setup', title: 'Profile Setup', description: 'Complete your profile information' },
                    { id: 'preferences', title: 'Preferences', description: 'Set your communication preferences' },
                    { id: 'getting_started', title: 'Getting Started', description: 'Learn how to use your package features' },
                ];
            case 'USER_REGISTRATION':
                return [
                    { id: 'profile_setup', title: 'Profile Setup', description: 'Complete your profile information' },
                    { id: 'preferences', title: 'Preferences', description: 'Set your preferences' },
                    { id: 'welcome', title: 'Welcome', description: 'Welcome to the platform' },
                ];
            default:
                return [];
        }
    }

    /**
     * Send verification email (placeholder - integrate with email service)
     */
    private static async sendVerificationEmail(
        email: string,
        token: string,
        verificationType: string,
        tenantId: string
    ): Promise<void> {
        // This would integrate with your email service
        console.log(`Sending ${verificationType} verification email to ${email} with token ${token}`);
    }

    /**
     * Send invitation email (placeholder - integrate with email service)
     */
    private static async sendInvitationEmail(
        email: string,
        token: string,
        role: UserRole,
        tenantId: string,
        customMessage?: string
    ): Promise<void> {
        // This would integrate with your email service
        console.log(`Sending invitation email to ${email} for role ${role} with token ${token}`);
    }

    /**
     * Notify superadmins about new verification request
     */
    private static async notifySuperadminsForVerification(verificationId: string): Promise<void> {
        // This would send notifications to superadmins
        console.log(`Notifying superadmins about verification request ${verificationId}`);
    }

    /**
     * Send verification result email
     */
    private static async sendVerificationResultEmail(
        email: string,
        decision: string,
        companyName: string,
        reviewNotes?: string
    ): Promise<void> {
        // This would send the verification result email
        console.log(`Sending verification result (${decision}) to ${email} for ${companyName}`);
    }
}