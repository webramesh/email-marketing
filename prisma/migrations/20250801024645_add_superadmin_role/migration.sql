-- AlterTable
ALTER TABLE `users` MODIFY `role` ENUM('SUPERADMIN', 'ADMIN', 'USER', 'SUPPORT') NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE `consent_records` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `subscriberId` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `consentType` ENUM('MARKETING_EMAILS', 'ANALYTICS_TRACKING', 'THIRD_PARTY_SHARING', 'PROFILING', 'AUTOMATED_DECISION_MAKING') NOT NULL,
    `status` ENUM('GIVEN', 'WITHDRAWN', 'PENDING', 'EXPIRED') NOT NULL DEFAULT 'GIVEN',
    `purpose` JSON NOT NULL,
    `legalBasis` VARCHAR(191) NOT NULL,
    `consentDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `withdrawalDate` DATETIME(3) NULL,
    `expiryDate` DATETIME(3) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `consentMethod` VARCHAR(191) NOT NULL,
    `consentText` LONGTEXT NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `consent_records_tenantId_idx`(`tenantId`),
    INDEX `consent_records_email_idx`(`email`),
    INDEX `consent_records_consentType_idx`(`consentType`),
    INDEX `consent_records_status_idx`(`status`),
    INDEX `consent_records_subscriberId_idx`(`subscriberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gdpr_requests` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `requestType` ENUM('ACCESS', 'RECTIFICATION', 'ERASURE', 'PORTABILITY', 'RESTRICTION', 'OBJECTION') NOT NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `email` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `requestDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completionDate` DATETIME(3) NULL,
    `verificationToken` VARCHAR(191) NOT NULL,
    `verificationExpiry` DATETIME(3) NOT NULL,
    `isVerified` BOOLEAN NOT NULL DEFAULT false,
    `requestDetails` JSON NULL,
    `responseData` JSON NULL,
    `rejectionReason` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `gdpr_requests_tenantId_idx`(`tenantId`),
    INDEX `gdpr_requests_email_idx`(`email`),
    INDEX `gdpr_requests_requestType_idx`(`requestType`),
    INDEX `gdpr_requests_status_idx`(`status`),
    INDEX `gdpr_requests_verificationToken_idx`(`verificationToken`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `data_processing_activities` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `activityName` VARCHAR(191) NOT NULL,
    `purpose` JSON NOT NULL,
    `legalBasis` VARCHAR(191) NOT NULL,
    `dataCategories` JSON NOT NULL,
    `dataSubjects` JSON NOT NULL,
    `recipients` JSON NULL,
    `thirdCountries` JSON NULL,
    `retentionPeriod` VARCHAR(191) NOT NULL,
    `securityMeasures` JSON NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `data_processing_activities_tenantId_idx`(`tenantId`),
    INDEX `data_processing_activities_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `privacy_policies` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `effectiveDate` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `privacy_policies_tenantId_idx`(`tenantId`),
    INDEX `privacy_policies_isActive_idx`(`isActive`),
    INDEX `privacy_policies_effectiveDate_idx`(`effectiveDate`),
    UNIQUE INDEX `privacy_policies_tenantId_version_key`(`tenantId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
