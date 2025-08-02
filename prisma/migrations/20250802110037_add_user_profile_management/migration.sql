-- AlterTable
ALTER TABLE `users` ADD COLUMN `bio` LONGTEXT NULL,
    ADD COLUMN `dateFormat` VARCHAR(191) NULL DEFAULT 'MM/dd/yyyy',
    ADD COLUMN `deactivatedAt` DATETIME(3) NULL,
    ADD COLUMN `deactivationReason` VARCHAR(191) NULL,
    ADD COLUMN `emailNotifications` JSON NULL,
    ADD COLUMN `firstName` VARCHAR(191) NULL,
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `language` VARCHAR(191) NULL DEFAULT 'en',
    ADD COLUMN `lastName` VARCHAR(191) NULL,
    ADD COLUMN `phoneNumber` VARCHAR(191) NULL,
    ADD COLUMN `profilePicture` VARCHAR(191) NULL,
    ADD COLUMN `pushNotifications` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `reactivatedAt` DATETIME(3) NULL,
    ADD COLUMN `smsNotifications` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `timeFormat` VARCHAR(191) NULL DEFAULT '12h',
    ADD COLUMN `timezone` VARCHAR(191) NULL DEFAULT 'UTC';

-- CreateTable
CREATE TABLE `user_profile_history` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `changeType` ENUM('PROFILE_UPDATE', 'PASSWORD_CHANGE', 'EMAIL_CHANGE', 'PREFERENCES_UPDATE', 'ACCOUNT_DEACTIVATION', 'ACCOUNT_REACTIVATION', 'PROFILE_PICTURE_UPLOAD', 'PROFILE_PICTURE_REMOVE') NOT NULL,
    `fieldName` VARCHAR(191) NOT NULL,
    `oldValue` LONGTEXT NULL,
    `newValue` LONGTEXT NULL,
    `changedBy` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_profile_history_userId_idx`(`userId`),
    INDEX `user_profile_history_changeType_idx`(`changeType`),
    INDEX `user_profile_history_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `users_isActive_idx` ON `users`(`isActive`);
