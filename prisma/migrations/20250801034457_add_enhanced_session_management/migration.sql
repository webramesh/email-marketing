-- AlterTable
ALTER TABLE `users` ADD COLUMN `lastActivityAt` DATETIME(3) NULL,
    ADD COLUMN `lastLoginAt` DATETIME(3) NULL,
    ADD COLUMN `maxConcurrentSessions` INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN `rememberMeEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `sessionTimeout` INTEGER NOT NULL DEFAULT 86400;

-- CreateTable
CREATE TABLE `user_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `sessionToken` VARCHAR(191) NOT NULL,
    `deviceId` VARCHAR(191) NULL,
    `deviceName` VARCHAR(191) NULL,
    `deviceType` VARCHAR(191) NULL,
    `browser` VARCHAR(191) NULL,
    `browserVersion` VARCHAR(191) NULL,
    `os` VARCHAR(191) NULL,
    `osVersion` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NOT NULL,
    `location` JSON NULL,
    `userAgent` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastActivityAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_sessions_sessionToken_key`(`sessionToken`),
    INDEX `user_sessions_userId_idx`(`userId`),
    INDEX `user_sessions_sessionToken_idx`(`sessionToken`),
    INDEX `user_sessions_isActive_idx`(`isActive`),
    INDEX `user_sessions_expiresAt_idx`(`expiresAt`),
    INDEX `user_sessions_lastActivityAt_idx`(`lastActivityAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session_activities` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `resource` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NOT NULL,
    `userAgent` VARCHAR(191) NULL,
    `location` JSON NULL,
    `metadata` JSON NULL,
    `riskScore` DOUBLE NULL,
    `isBlocked` BOOLEAN NOT NULL DEFAULT false,
    `blockReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `session_activities_userId_idx`(`userId`),
    INDEX `session_activities_sessionId_idx`(`sessionId`),
    INDEX `session_activities_action_idx`(`action`),
    INDEX `session_activities_createdAt_idx`(`createdAt`),
    INDEX `session_activities_riskScore_idx`(`riskScore`),
    INDEX `session_activities_isBlocked_idx`(`isBlocked`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `remember_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `deviceId` VARCHAR(191) NULL,
    `deviceFingerprint` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NOT NULL,
    `userAgent` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastUsedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `remember_tokens_tokenHash_key`(`tokenHash`),
    INDEX `remember_tokens_userId_idx`(`userId`),
    INDEX `remember_tokens_tokenHash_idx`(`tokenHash`),
    INDEX `remember_tokens_isActive_idx`(`isActive`),
    INDEX `remember_tokens_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `security_events` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `tenantId` VARCHAR(191) NULL,
    `eventType` ENUM('FAILED_LOGIN', 'SUSPICIOUS_LOGIN', 'MULTIPLE_FAILED_ATTEMPTS', 'UNUSUAL_LOCATION', 'CONCURRENT_SESSION_LIMIT', 'SESSION_HIJACK_ATTEMPT', 'BRUTE_FORCE_ATTEMPT', 'ACCOUNT_LOCKOUT', 'PASSWORD_RESET_REQUEST', 'MFA_BYPASS_ATTEMPT', 'PRIVILEGE_ESCALATION', 'UNAUTHORIZED_ACCESS') NOT NULL,
    `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'LOW',
    `description` VARCHAR(191) NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `location` JSON NULL,
    `metadata` JSON NULL,
    `isResolved` BOOLEAN NOT NULL DEFAULT false,
    `resolvedAt` DATETIME(3) NULL,
    `resolvedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `security_events_userId_idx`(`userId`),
    INDEX `security_events_tenantId_idx`(`tenantId`),
    INDEX `security_events_eventType_idx`(`eventType`),
    INDEX `security_events_severity_idx`(`severity`),
    INDEX `security_events_createdAt_idx`(`createdAt`),
    INDEX `security_events_isResolved_idx`(`isResolved`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
