import { prisma } from '@/lib/prisma';
import { SecurityMonitoringService, ThreatType } from './security-monitoring.service';
import { SecurityAuditService, AuditAction, SecurityRiskLevel } from './security-audit.service';
import { logSecurityEvent } from '@/lib/session-management';

export interface SecurityResponseRule {
    id: string;
    triggerType: ThreatType;
    responseType: SecurityResponseType;
    tenantId?: string;
    isActive: boolean;
    conditions: SecurityResponseCondition[];
    actions: SecurityResponseAction[];
    cooldownPeriod?: number;
    lastTriggeredAt?: Date;
    triggerCount: number;
}

export interface SecurityResponseCondition {
    field: string; // e.g., 'riskScore', 'ipAddress', 'userAgent', 'location.country'
    operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains' | 'in' | 'not_in';
    value: any;
}

export interface SecurityResponseAction {
    type: SecurityResponseActionType;
    parameters: Record<string, any>;
    delay?: number; // Delay in seconds before executing this action
}

export enum SecurityResponseType {
    IMMEDIATE = 'IMMEDIATE',
    DELAYED = 'DELAYED',
    ESCALATED = 'ESCALATED',
    CONDITIONAL = 'CONDITIONAL',
}

export enum SecurityResponseActionType {
    BLOCK_IP = 'BLOCK_IP',
    LOCK_ACCOUNT = 'LOCK_ACCOUNT',
    REQUIRE_MFA = 'REQUIRE_MFA',
    SEND_ALERT = 'SEND_ALERT',
    LOG_EVENT = 'LOG_EVENT',
    RATE_LIMIT = 'RATE_LIMIT',
    QUARANTINE_SESSION = 'QUARANTINE_SESSION',
    NOTIFY_ADMIN = 'NOTIFY_ADMIN',
    INVALIDATE_SESSIONS = 'INVALIDATE_SESSIONS',
    TEMPORARY_SUSPENSION = 'TEMPORARY_SUSPENSION',
}

export class AutomatedSecurityResponseService {
    private static instance: AutomatedSecurityResponseService;
    private securityMonitoringService: SecurityMonitoringService;
    private auditService: SecurityAuditService;

    constructor() {
        this.securityMonitoringService = SecurityMonitoringService.getInstance();
        this.auditService = SecurityAuditService.getInstance();
    }

    static getInstance(): AutomatedSecurityResponseService {
        if (!AutomatedSecurityResponseService.instance) {
            AutomatedSecurityResponseService.instance = new AutomatedSecurityResponseService();
        }
        return AutomatedSecurityResponseService.instance;
    }

    /**
     * Process security threat and trigger automated responses
     */
    async processThreat(
        threatType: ThreatType,
        severity: SecurityRiskLevel,
        context: {
            userId?: string;
            tenantId?: string;
            ipAddress?: string;
            userAgent?: string;
            location?: any;
            metadata?: Record<string, any>;
        }
    ): Promise<void> {
        try {
            // Get applicable response rules
            const rules = await this.getApplicableRules(threatType, context.tenantId);

            for (const rule of rules) {
                // Check if rule conditions are met
                if (await this.evaluateConditions(rule.conditions, { ...context, severity })) {
                    // Check cooldown period
                    if (this.isInCooldown(rule)) {
                        continue;
                    }

                    // Execute the response
                    await this.executeResponse(rule, context);

                    // Update rule trigger count and timestamp
                    await this.updateRuleTrigger(rule.id);

                    // Log the automated response
                    await this.auditService.logAuditEvent({
                        tenantId: context.tenantId || 'system',
                        userId: context.userId,
                        action: AuditAction.SECURITY_VIOLATION,
                        resource: 'automated_response',
                        resourceId: rule.id,
                        ipAddress: context.ipAddress,
                        userAgent: context.userAgent,
                        metadata: {
                            threatType,
                            severity,
                            ruleId: rule.id,
                            responseType: rule.responseType,
                            actions: rule.actions.map(a => a.type),
                            context,
                        },
                        riskLevel: severity,
                    });
                }
            }
        } catch (error) {
            console.error('Error processing automated security response:', error);
        }
    }

    /**
     * Get applicable response rules for a threat type and tenant
     */
    private async getApplicableRules(
        threatType: ThreatType,
        tenantId?: string
    ): Promise<SecurityResponseRule[]> {
        try {
            const rules = await prisma.securityResponse.findMany({
                where: {
                    triggerType: threatType,
                    isActive: true,
                    OR: [
                        { tenantId: tenantId },
                        { tenantId: null }, // Global rules
                    ],
                },
                orderBy: [
                    { tenantId: 'desc' }, // Tenant-specific rules first
                    { createdAt: 'asc' },
                ],
            });

            return rules.map(rule => ({
                id: rule.id,
                triggerType: rule.triggerType as ThreatType,
                responseType: rule.responseType as SecurityResponseType,
                tenantId: rule.tenantId || undefined,
                isActive: rule.isActive,
                conditions: (rule.conditions as any) || [],
                actions: (rule.actions as any) || [],
                cooldownPeriod: rule.cooldownPeriod || undefined,
                lastTriggeredAt: rule.lastTriggeredAt || undefined,
                triggerCount: rule.triggerCount,
            }));
        } catch (error) {
            console.error('Error getting applicable rules:', error);
            return [];
        }
    }

    /**
     * Evaluate if conditions are met for a rule
     */
    private async evaluateConditions(
        conditions: SecurityResponseCondition[],
        context: any
    ): Promise<boolean> {
        if (conditions.length === 0) return true;

        for (const condition of conditions) {
            if (!this.evaluateCondition(condition, context)) {
                return false; // All conditions must be met (AND logic)
            }
        }

        return true;
    }

    /**
     * Evaluate a single condition
     */
    private evaluateCondition(condition: SecurityResponseCondition, context: any): boolean {
        const value = this.getNestedValue(context, condition.field);

        switch (condition.operator) {
            case 'equals':
                return value === condition.value;
            case 'not_equals':
                return value !== condition.value;
            case 'greater_than':
                return typeof value === 'number' && value > condition.value;
            case 'less_than':
                return typeof value === 'number' && value < condition.value;
            case 'contains':
                return typeof value === 'string' && value.includes(condition.value);
            case 'not_contains':
                return typeof value === 'string' && !value.includes(condition.value);
            case 'in':
                return Array.isArray(condition.value) && condition.value.includes(value);
            case 'not_in':
                return Array.isArray(condition.value) && !condition.value.includes(value);
            default:
                return false;
        }
    }

    /**
     * Get nested value from object using dot notation
     */
    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    /**
     * Check if rule is in cooldown period
     */
    private isInCooldown(rule: SecurityResponseRule): boolean {
        if (!rule.cooldownPeriod || !rule.lastTriggeredAt) {
            return false;
        }

        const cooldownEnd = new Date(rule.lastTriggeredAt.getTime() + rule.cooldownPeriod * 1000);
        return new Date() < cooldownEnd;
    }

    /**
     * Execute automated response actions
     */
    private async executeResponse(
        rule: SecurityResponseRule,
        context: {
            userId?: string;
            tenantId?: string;
            ipAddress?: string;
            userAgent?: string;
            location?: any;
            metadata?: Record<string, any>;
        }
    ): Promise<void> {
        try {
            for (const action of rule.actions) {
                // Apply delay if specified
                if (action.delay && action.delay > 0) {
                    setTimeout(() => {
                        this.executeAction(action, context, rule.id);
                    }, action.delay * 1000);
                } else {
                    await this.executeAction(action, context, rule.id);
                }
            }
        } catch (error) {
            console.error('Error executing response:', error);
        }
    }

    /**
     * Execute a single response action
     */
    private async executeAction(
        action: SecurityResponseAction,
        context: {
            userId?: string;
            tenantId?: string;
            ipAddress?: string;
            userAgent?: string;
            location?: any;
            metadata?: Record<string, any>;
        },
        ruleId: string
    ): Promise<void> {
        try {
            switch (action.type) {
                case SecurityResponseActionType.BLOCK_IP:
                    await this.blockIP(context.ipAddress!, action.parameters, context.tenantId);
                    break;

                case SecurityResponseActionType.LOCK_ACCOUNT:
                    await this.lockAccount(context.userId!, action.parameters);
                    break;

                case SecurityResponseActionType.REQUIRE_MFA:
                    await this.requireMFA(context.userId!, action.parameters);
                    break;

                case SecurityResponseActionType.SEND_ALERT:
                    await this.sendAlert(action.parameters, context);
                    break;

                case SecurityResponseActionType.LOG_EVENT:
                    await this.logSecurityEvent(action.parameters, context);
                    break;

                case SecurityResponseActionType.RATE_LIMIT:
                    await this.applyRateLimit(context.ipAddress!, action.parameters);
                    break;

                case SecurityResponseActionType.QUARANTINE_SESSION:
                    await this.quarantineSession(context.userId!, action.parameters);
                    break;

                case SecurityResponseActionType.NOTIFY_ADMIN:
                    await this.notifyAdmin(action.parameters, context);
                    break;

                case SecurityResponseActionType.INVALIDATE_SESSIONS:
                    await this.invalidateSessions(context.userId!, action.parameters);
                    break;

                case SecurityResponseActionType.TEMPORARY_SUSPENSION:
                    await this.temporarySuspension(context.userId!, action.parameters);
                    break;

                default:
                    console.warn(`Unknown action type: ${action.type}`);
            }

            console.log(`Executed automated security action: ${action.type} for rule ${ruleId}`);
        } catch (error) {
            console.error(`Error executing action ${action.type}:`, error);
        }
    }

    /**
     * Block IP address
     */
    private async blockIP(
        ipAddress: string,
        parameters: Record<string, any>,
        tenantId?: string
    ): Promise<void> {
        const duration = parameters.duration || 3600; // Default 1 hour
        const reason = parameters.reason || 'Automated security response';
        const expiresAt = new Date(Date.now() + duration * 1000);

        await this.securityMonitoringService.addIPRestriction(
            ipAddress,
            'BLOCK',
            tenantId || null,
            reason,
            'system',
            expiresAt
        );
    }

    /**
     * Lock user account
     */
    private async lockAccount(userId: string, parameters: Record<string, any>): Promise<void> {
        const duration = parameters.duration || 900; // Default 15 minutes
        const lockedUntil = new Date(Date.now() + duration * 1000);

        await prisma.user.update({
            where: { id: userId },
            data: {
                lockedUntil,
                failedLoginAttempts: 999, // High number to indicate automated lock
            },
        });

        await logSecurityEvent(
            userId,
            'ACCOUNT_LOCKOUT',
            'HIGH',
            'Account locked by automated security response',
            { duration, reason: 'Automated response' }
        );
    }

    /**
     * Require MFA for user
     */
    private async requireMFA(userId: string, parameters: Record<string, any>): Promise<void> {
        // This would typically set a flag requiring MFA verification
        // Implementation depends on your MFA system
        await prisma.user.update({
            where: { id: userId },
            data: {
                // Add a field to track MFA requirement
                mustChangePassword: true, // Temporary use of existing field
            },
        });

        await logSecurityEvent(
            userId,
            'MFA_REQUIRED',
            'MEDIUM',
            'MFA required by automated security response',
            parameters
        );
    }

    /**
     * Send security alert
     */
    private async sendAlert(
        parameters: Record<string, any>,
        context: any
    ): Promise<void> {
        const alertType = parameters.alertType || 'SECURITY_INCIDENT';
        const severity = parameters.severity || 'MEDIUM';
        const message = parameters.message || 'Automated security alert triggered';

        // Create security alert record
        await prisma.securityAlert.create({
            data: {
                type: alertType,
                severity: severity,
                title: parameters.title || 'Automated Security Alert',
                description: message,
                userId: context.userId,
                tenantId: context.tenantId,
                actionRequired: parameters.actionRequired || false,
                metadata: {
                    context,
                    parameters,
                    triggeredBy: 'automated_response',
                },
            },
        });

        console.warn('AUTOMATED_SECURITY_ALERT:', {
            type: alertType,
            severity,
            message,
            context,
        });
    }

    /**
     * Log security event
     */
    private async logSecurityEvent(
        parameters: Record<string, any>,
        context: any
    ): Promise<void> {
        await logSecurityEvent(
            context.userId || 'system',
            parameters.eventType || 'AUTOMATED_RESPONSE',
            parameters.severity || 'MEDIUM',
            parameters.description || 'Automated security response triggered',
            { context, parameters }
        );
    }

    /**
     * Apply rate limiting
     */
    private async applyRateLimit(
        ipAddress: string,
        parameters: Record<string, any>
    ): Promise<void> {
        // This would integrate with your rate limiting system
        // For now, we'll log the action
        console.log(`Rate limiting applied to IP ${ipAddress}:`, parameters);
    }

    /**
     * Quarantine user session
     */
    private async quarantineSession(
        userId: string,
        parameters: Record<string, any>
    ): Promise<void> {
        // Invalidate all active sessions for the user
        await prisma.userSession.updateMany({
            where: {
                userId,
                isActive: true,
            },
            data: {
                isActive: false,
            },
        });

        await logSecurityEvent(
            userId,
            'SESSION_QUARANTINE',
            'HIGH',
            'User sessions quarantined by automated security response',
            parameters
        );
    }

    /**
     * Notify administrators
     */
    private async notifyAdmin(
        parameters: Record<string, any>,
        context: any
    ): Promise<void> {
        // This would send notifications to administrators
        // Implementation depends on your notification system
        console.warn('ADMIN_NOTIFICATION:', {
            message: parameters.message || 'Automated security response triggered',
            context,
            parameters,
        });
    }

    /**
     * Invalidate user sessions
     */
    private async invalidateSessions(
        userId: string,
        parameters: Record<string, any>
    ): Promise<void> {
        const exceptCurrent = parameters.exceptCurrent || false;
        const sessionId = parameters.currentSessionId;

        const whereClause: any = {
            userId,
            isActive: true,
        };

        if (exceptCurrent && sessionId) {
            whereClause.id = { not: sessionId };
        }

        await prisma.userSession.updateMany({
            where: whereClause,
            data: { isActive: false },
        });

        await logSecurityEvent(
            userId,
            'SESSIONS_INVALIDATED',
            'MEDIUM',
            'User sessions invalidated by automated security response',
            parameters
        );
    }

    /**
     * Temporarily suspend user account
     */
    private async temporarySuspension(
        userId: string,
        parameters: Record<string, any>
    ): Promise<void> {
        const duration = parameters.duration || 86400; // Default 24 hours
        const reason = parameters.reason || 'Automated security response';

        await prisma.user.update({
            where: { id: userId },
            data: {
                isActive: false,
                deactivatedAt: new Date(),
                deactivationReason: reason,
            },
        });

        // Schedule reactivation
        setTimeout(async () => {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    isActive: true,
                    reactivatedAt: new Date(),
                },
            });

            await logSecurityEvent(
                userId,
                'ACCOUNT_REACTIVATED',
                'LOW',
                'Account automatically reactivated after temporary suspension'
            );
        }, duration * 1000);

        await logSecurityEvent(
            userId,
            'ACCOUNT_SUSPENDED',
            'HIGH',
            `Account temporarily suspended: ${reason}`,
            { duration, reason }
        );
    }

    /**
     * Update rule trigger count and timestamp
     */
    private async updateRuleTrigger(ruleId: string): Promise<void> {
        await prisma.securityResponse.update({
            where: { id: ruleId },
            data: {
                lastTriggeredAt: new Date(),
                triggerCount: { increment: 1 },
            },
        });
    }

    /**
     * Create a new security response rule
     */
    async createResponseRule(
        rule: Omit<SecurityResponseRule, 'id' | 'triggerCount' | 'lastTriggeredAt'>,
        createdBy: string
    ): Promise<string> {
        const created = await prisma.securityResponse.create({
            data: {
                triggerType: rule.triggerType,
                responseType: rule.responseType,
                tenantId: rule.tenantId,
                isActive: rule.isActive,
                conditions: rule.conditions as any, // Cast to any for JSON field
                actions: rule.actions as any, // Cast to any for JSON field
                cooldownPeriod: rule.cooldownPeriod,
                createdBy,
            },
        });

        return created.id;
    }

    /**
     * Get response rules for a tenant
     */
    async getResponseRules(tenantId?: string): Promise<SecurityResponseRule[]> {
        const rules = await prisma.securityResponse.findMany({
            where: {
                OR: [
                    { tenantId: tenantId },
                    { tenantId: null }, // Global rules
                ],
            },
            orderBy: { createdAt: 'desc' },
        });

        return rules.map(rule => ({
            id: rule.id,
            triggerType: rule.triggerType as ThreatType,
            responseType: rule.responseType as SecurityResponseType,
            tenantId: rule.tenantId || undefined,
            isActive: rule.isActive,
            conditions: (rule.conditions as any) || [],
            actions: (rule.actions as any) || [],
            cooldownPeriod: rule.cooldownPeriod || undefined,
            lastTriggeredAt: rule.lastTriggeredAt || undefined,
            triggerCount: rule.triggerCount,
        }));
    }

    /**
     * Update response rule
     */
    async updateResponseRule(
        ruleId: string,
        updates: Partial<SecurityResponseRule>
    ): Promise<void> {
        const updateData: any = {};

        if (updates.triggerType) {
            updateData.triggerType = updates.triggerType;
        }
        if (updates.responseType) {
            updateData.responseType = updates.responseType;
        }
        if (updates.isActive !== undefined) {
            updateData.isActive = updates.isActive;
        }
        if (updates.conditions) {
            updateData.conditions = updates.conditions as any; // Cast to any for JSON field
        }
        if (updates.actions) {
            updateData.actions = updates.actions as any; // Cast to any for JSON field
        }
        if (updates.cooldownPeriod !== undefined) {
            updateData.cooldownPeriod = updates.cooldownPeriod;
        }

        await prisma.securityResponse.update({
            where: { id: ruleId },
            data: updateData,
        });
    }

    /**
     * Delete response rule
     */
    async deleteResponseRule(ruleId: string): Promise<void> {
        await prisma.securityResponse.delete({
            where: { id: ruleId },
        });
    }
}