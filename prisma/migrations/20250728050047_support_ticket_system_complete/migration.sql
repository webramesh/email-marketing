/*
  Warnings:

  - You are about to drop the column `configuration` on the `forms` table. All the data in the column will be lost.
  - You are about to alter the column `formType` on the `forms` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(5))`.
  - A unique constraint covering the columns `[ticketNumber]` on the table `support_tickets` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `fields` to the `forms` table without a default value. This is not possible if the table is not empty.
  - Added the required column `requesterEmail` to the `support_tickets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ticketNumber` to the `support_tickets` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `api_keys` ADD COLUMN `userId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `forms` DROP COLUMN `configuration`,
    ADD COLUMN `conversionRate` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `description` VARCHAR(191) NULL,
    ADD COLUMN `displayRules` JSON NULL,
    ADD COLUMN `embedCode` LONGTEXT NULL,
    ADD COLUMN `embedDomain` VARCHAR(191) NULL,
    ADD COLUMN `fields` JSON NOT NULL,
    ADD COLUMN `settings` JSON NULL,
    ADD COLUMN `status` ENUM('DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN `styling` JSON NULL,
    ADD COLUMN `targetLists` JSON NULL,
    ADD COLUMN `totalSubmissions` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `totalViews` INTEGER NOT NULL DEFAULT 0,
    MODIFY `formType` ENUM('SUBSCRIPTION', 'POPUP', 'EMBEDDED', 'LANDING_PAGE') NOT NULL DEFAULT 'SUBSCRIPTION';

-- AlterTable
ALTER TABLE `sending_servers` ADD COLUMN `dailyLimit` INTEGER NULL,
    ADD COLUMN `dailySent` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `hourlyLimit` INTEGER NULL,
    ADD COLUMN `hourlySent` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lastResetAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `lastUsedAt` DATETIME(3) NULL,
    ADD COLUMN `priority` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `totalFailed` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `totalSent` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `subscription_plans` ADD COLUMN `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    ADD COLUMN `description` VARCHAR(191) NULL,
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `metadata` JSON NULL,
    ADD COLUMN `quotas` JSON NOT NULL,
    ADD COLUMN `setupFee` DOUBLE NULL,
    ADD COLUMN `trialDays` INTEGER NULL;

-- AlterTable
ALTER TABLE `support_tickets` ADD COLUMN `assignedCompany` VARCHAR(191) NULL,
    ADD COLUMN `assignedToUserId` VARCHAR(191) NULL,
    ADD COLUMN `category` ENUM('GENERAL', 'TECHNICAL', 'BILLING', 'FEATURE_REQUEST', 'BUG_REPORT', 'ACCOUNT', 'INTEGRATION') NOT NULL DEFAULT 'GENERAL',
    ADD COLUMN `closedAt` DATETIME(3) NULL,
    ADD COLUMN `customFields` JSON NULL,
    ADD COLUMN `dueDate` DATETIME(3) NULL,
    ADD COLUMN `escalatedAt` DATETIME(3) NULL,
    ADD COLUMN `escalationLevel` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `firstResponseAt` DATETIME(3) NULL,
    ADD COLUMN `language` VARCHAR(191) NOT NULL DEFAULT 'en',
    ADD COLUMN `requesterEmail` VARCHAR(191) NOT NULL,
    ADD COLUMN `requesterName` VARCHAR(191) NULL,
    ADD COLUMN `requesterUserId` VARCHAR(191) NULL,
    ADD COLUMN `resolvedAt` DATETIME(3) NULL,
    ADD COLUMN `slaLevel` ENUM('BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE') NOT NULL DEFAULT 'STANDARD',
    ADD COLUMN `source` ENUM('WEB', 'EMAIL', 'API', 'PHONE', 'CHAT') NOT NULL DEFAULT 'WEB',
    ADD COLUMN `tags` JSON NULL,
    ADD COLUMN `ticketNumber` VARCHAR(191) NOT NULL;

-- CreateTable
CREATE TABLE `form_submissions` (
    `id` VARCHAR(191) NOT NULL,
    `formId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `customFields` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `referrer` VARCHAR(191) NULL,
    `location` JSON NULL,
    `subscriberId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `form_submissions_formId_idx`(`formId`),
    INDEX `form_submissions_email_idx`(`email`),
    INDEX `form_submissions_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `form_analytics` (
    `id` VARCHAR(191) NOT NULL,
    `formId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `views` INTEGER NOT NULL DEFAULT 0,
    `submissions` INTEGER NOT NULL DEFAULT 0,
    `conversionRate` DOUBLE NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `form_analytics_formId_idx`(`formId`),
    INDEX `form_analytics_date_idx`(`date`),
    UNIQUE INDEX `form_analytics_formId_date_key`(`formId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELLED', 'UNPAID', 'INCOMPLETE', 'INCOMPLETE_EXPIRED') NOT NULL DEFAULT 'ACTIVE',
    `currentPeriodStart` DATETIME(3) NOT NULL,
    `currentPeriodEnd` DATETIME(3) NOT NULL,
    `cancelAtPeriodEnd` BOOLEAN NOT NULL DEFAULT false,
    `trialEnd` DATETIME(3) NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `subscriptionId` VARCHAR(191) NOT NULL,
    `paymentProvider` VARCHAR(191) NOT NULL,
    `quotas` JSON NOT NULL,
    `usage` JSON NOT NULL,
    `billingAddress` JSON NULL,
    `taxRate` DOUBLE NULL,
    `discountId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tenant_subscriptions_tenantId_key`(`tenantId`),
    INDEX `tenant_subscriptions_tenantId_idx`(`tenantId`),
    INDEX `tenant_subscriptions_planId_idx`(`planId`),
    INDEX `tenant_subscriptions_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `billing_cycles` (
    `id` VARCHAR(191) NOT NULL,
    `subscriptionId` VARCHAR(191) NOT NULL,
    `cycleStart` DATETIME(3) NOT NULL,
    `cycleEnd` DATETIME(3) NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `invoiceId` VARCHAR(191) NULL,
    `paymentId` VARCHAR(191) NULL,
    `retryCount` INTEGER NOT NULL DEFAULT 0,
    `nextRetryAt` DATETIME(3) NULL,
    `failureReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `billing_cycles_subscriptionId_idx`(`subscriptionId`),
    INDEX `billing_cycles_status_idx`(`status`),
    INDEX `billing_cycles_cycleStart_idx`(`cycleStart`),
    INDEX `billing_cycles_cycleEnd_idx`(`cycleEnd`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoices` (
    `id` VARCHAR(191) NOT NULL,
    `subscriptionId` VARCHAR(191) NOT NULL,
    `invoiceNumber` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE') NOT NULL DEFAULT 'OPEN',
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `subtotal` DOUBLE NOT NULL,
    `taxAmount` DOUBLE NOT NULL DEFAULT 0,
    `discountAmount` DOUBLE NOT NULL DEFAULT 0,
    `total` DOUBLE NOT NULL,
    `amountPaid` DOUBLE NOT NULL DEFAULT 0,
    `amountDue` DOUBLE NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `paidAt` DATETIME(3) NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `lineItems` JSON NOT NULL,
    `billingAddress` JSON NULL,
    `paymentProvider` VARCHAR(191) NOT NULL,
    `providerInvoiceId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `invoices_invoiceNumber_key`(`invoiceNumber`),
    INDEX `invoices_subscriptionId_idx`(`subscriptionId`),
    INDEX `invoices_status_idx`(`status`),
    INDEX `invoices_dueDate_idx`(`dueDate`),
    INDEX `invoices_invoiceNumber_idx`(`invoiceNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `overage_billings` (
    `id` VARCHAR(191) NOT NULL,
    `subscriptionId` VARCHAR(191) NOT NULL,
    `resourceType` VARCHAR(191) NOT NULL,
    `quotaLimit` INTEGER NOT NULL,
    `actualUsage` INTEGER NOT NULL,
    `overageAmount` INTEGER NOT NULL,
    `unitPrice` DOUBLE NOT NULL,
    `billingPeriodStart` DATETIME(3) NOT NULL,
    `billingPeriodEnd` DATETIME(3) NOT NULL,
    `status` ENUM('PENDING', 'BILLED', 'PAID') NOT NULL DEFAULT 'PENDING',
    `invoiceId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `overage_billings_subscriptionId_idx`(`subscriptionId`),
    INDEX `overage_billings_status_idx`(`status`),
    INDEX `overage_billings_resourceType_idx`(`resourceType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_changes` (
    `id` VARCHAR(191) NOT NULL,
    `subscriptionId` VARCHAR(191) NOT NULL,
    `changeType` ENUM('UPGRADE', 'DOWNGRADE', 'PLAN_CHANGE') NOT NULL,
    `fromPlanId` VARCHAR(191) NOT NULL,
    `toPlanId` VARCHAR(191) NOT NULL,
    `prorationAmount` DOUBLE NOT NULL DEFAULT 0,
    `effectiveDate` DATETIME(3) NOT NULL,
    `status` ENUM('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `subscription_changes_subscriptionId_idx`(`subscriptionId`),
    INDEX `subscription_changes_changeType_idx`(`changeType`),
    INDEX `subscription_changes_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `api_key_usage` (
    `id` VARCHAR(191) NOT NULL,
    `apiKeyId` VARCHAR(191) NOT NULL,
    `endpoint` VARCHAR(191) NOT NULL,
    `method` VARCHAR(191) NOT NULL,
    `statusCode` INTEGER NOT NULL,
    `responseTime` INTEGER NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `api_key_usage_apiKeyId_idx`(`apiKeyId`),
    INDEX `api_key_usage_timestamp_idx`(`timestamp`),
    INDEX `api_key_usage_endpoint_idx`(`endpoint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scheduled_reports` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `reportConfig` JSON NOT NULL,
    `schedule` JSON NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastRunAt` DATETIME(3) NULL,
    `nextRunAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,

    INDEX `scheduled_reports_tenantId_idx`(`tenantId`),
    INDEX `scheduled_reports_isActive_idx`(`isActive`),
    INDEX `scheduled_reports_nextRunAt_idx`(`nextRunAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plugins` (
    `id` VARCHAR(191) NOT NULL,
    `pluginId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `author` VARCHAR(191) NOT NULL,
    `category` ENUM('AI', 'ANALYTICS', 'AUTOMATION', 'INTEGRATION', 'EMAIL_PROVIDER', 'PAYMENT', 'STORAGE', 'UTILITY') NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ERROR', 'UPDATING') NOT NULL DEFAULT 'ACTIVE',
    `config` JSON NOT NULL,
    `hooks` JSON NOT NULL,
    `permissions` JSON NOT NULL,
    `dependencies` JSON NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,

    INDEX `plugins_tenantId_idx`(`tenantId`),
    INDEX `plugins_category_idx`(`category`),
    INDEX `plugins_status_idx`(`status`),
    UNIQUE INDEX `plugins_pluginId_tenantId_key`(`pluginId`, `tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ticket_comments` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `isInternal` BOOLEAN NOT NULL DEFAULT false,
    `authorId` VARCHAR(191) NULL,
    `authorName` VARCHAR(191) NULL,
    `authorEmail` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ticket_comments_ticketId_idx`(`ticketId`),
    INDEX `ticket_comments_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ticket_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `uploadedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ticket_attachments_ticketId_idx`(`ticketId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ticket_escalations` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `fromLevel` INTEGER NOT NULL,
    `toLevel` INTEGER NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `escalatedBy` VARCHAR(191) NULL,
    `escalatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,

    INDEX `ticket_escalations_ticketId_idx`(`ticketId`),
    INDEX `ticket_escalations_escalatedAt_idx`(`escalatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ticket_sla_events` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `eventType` ENUM('FIRST_RESPONSE', 'RESOLUTION', 'ESCALATION') NOT NULL,
    `targetTime` DATETIME(3) NOT NULL,
    `actualTime` DATETIME(3) NULL,
    `isBreached` BOOLEAN NOT NULL DEFAULT false,
    `breachDuration` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ticket_sla_events_ticketId_idx`(`ticketId`),
    INDEX `ticket_sla_events_eventType_idx`(`eventType`),
    INDEX `ticket_sla_events_isBreached_idx`(`isBreached`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `support_agent_workloads` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `activeTickets` INTEGER NOT NULL DEFAULT 0,
    `totalTickets` INTEGER NOT NULL DEFAULT 0,
    `avgResponseTime` DOUBLE NOT NULL DEFAULT 0,
    `avgResolutionTime` DOUBLE NOT NULL DEFAULT 0,
    `workloadScore` DOUBLE NOT NULL DEFAULT 0,
    `lastUpdated` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `support_agent_workloads_tenantId_idx`(`tenantId`),
    INDEX `support_agent_workloads_workloadScore_idx`(`workloadScore`),
    UNIQUE INDEX `support_agent_workloads_userId_tenantId_key`(`userId`, `tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `support_sla_configs` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `slaLevel` ENUM('BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE') NOT NULL,
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL,
    `firstResponseTime` INTEGER NOT NULL,
    `resolutionTime` INTEGER NOT NULL,
    `escalationTime` INTEGER NOT NULL,
    `businessHoursOnly` BOOLEAN NOT NULL DEFAULT false,
    `businessHours` JSON NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `support_sla_configs_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `support_sla_configs_tenantId_slaLevel_priority_key`(`tenantId`, `slaLevel`, `priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `support_company_rules` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `companyName` VARCHAR(191) NOT NULL,
    `routingRules` JSON NOT NULL,
    `assignedAgents` JSON NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 1,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `support_company_rules_tenantId_idx`(`tenantId`),
    INDEX `support_company_rules_companyName_idx`(`companyName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_InvoiceToPayment` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_InvoiceToPayment_AB_unique`(`A`, `B`),
    INDEX `_InvoiceToPayment_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `forms_formType_idx` ON `forms`(`formType`);

-- CreateIndex
CREATE INDEX `forms_status_idx` ON `forms`(`status`);

-- CreateIndex
CREATE INDEX `sending_servers_isActive_idx` ON `sending_servers`(`isActive`);

-- CreateIndex
CREATE INDEX `sending_servers_priority_idx` ON `sending_servers`(`priority`);

-- CreateIndex
CREATE UNIQUE INDEX `support_tickets_ticketNumber_key` ON `support_tickets`(`ticketNumber`);

-- CreateIndex
CREATE INDEX `support_tickets_status_idx` ON `support_tickets`(`status`);

-- CreateIndex
CREATE INDEX `support_tickets_priority_idx` ON `support_tickets`(`priority`);

-- CreateIndex
CREATE INDEX `support_tickets_assignedToUserId_idx` ON `support_tickets`(`assignedToUserId`);

-- CreateIndex
CREATE INDEX `support_tickets_assignedCompany_idx` ON `support_tickets`(`assignedCompany`);

-- CreateIndex
CREATE INDEX `support_tickets_dueDate_idx` ON `support_tickets`(`dueDate`);

-- CreateIndex
CREATE INDEX `support_tickets_ticketNumber_idx` ON `support_tickets`(`ticketNumber`);
