-- AlterTable
ALTER TABLE `users` ADD COLUMN `compromisedAt` DATETIME(3) NULL,
    ADD COLUMN `failedLoginAttempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `isCompromised` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `lockedUntil` DATETIME(3) NULL,
    ADD COLUMN `mustChangePassword` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `passwordChangedAt` DATETIME(3) NULL,
    ADD COLUMN `passwordExpiresAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `password_history` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,

    INDEX `password_history_userId_idx`(`userId`),
    INDEX `password_history_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `isUsed` BOOLEAN NOT NULL DEFAULT false,
    `usedAt` DATETIME(3) NULL,
    `verificationMethod` ENUM('EMAIL', 'SMS', 'SECURITY_QUESTIONS', 'BACKUP_EMAIL', 'ADMIN_RESET') NOT NULL,
    `verificationData` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `password_reset_tokens_token_key`(`token`),
    UNIQUE INDEX `password_reset_tokens_tokenHash_key`(`tokenHash`),
    INDEX `password_reset_tokens_userId_idx`(`userId`),
    INDEX `password_reset_tokens_token_idx`(`token`),
    INDEX `password_reset_tokens_tokenHash_idx`(`tokenHash`),
    INDEX `password_reset_tokens_expiresAt_idx`(`expiresAt`),
    INDEX `password_reset_tokens_isUsed_idx`(`isUsed`),
    INDEX `password_reset_tokens_verificationMethod_idx`(`verificationMethod`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `users_passwordExpiresAt_idx` ON `users`(`passwordExpiresAt`);

-- CreateIndex
CREATE INDEX `users_mustChangePassword_idx` ON `users`(`mustChangePassword`);

-- CreateIndex
CREATE INDEX `users_failedLoginAttempts_idx` ON `users`(`failedLoginAttempts`);

-- CreateIndex
CREATE INDEX `users_lockedUntil_idx` ON `users`(`lockedUntil`);

-- CreateIndex
CREATE INDEX `users_isCompromised_idx` ON `users`(`isCompromised`);
