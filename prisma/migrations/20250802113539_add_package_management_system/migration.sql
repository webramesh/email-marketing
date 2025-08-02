-- CreateTable
CREATE TABLE `packages` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` LONGTEXT NULL,
    `shortDescription` VARCHAR(191) NULL,
    `category` ENUM('EMAIL_MARKETING', 'AUTOMATION', 'ANALYTICS', 'INTEGRATIONS', 'TEMPLATES', 'CUSTOM') NOT NULL DEFAULT 'EMAIL_MARKETING',
    `price` DOUBLE NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `billingCycle` ENUM('MONTHLY', 'QUARTERLY', 'YEARLY', 'ONE_TIME') NOT NULL DEFAULT 'MONTHLY',
    `setupFee` DOUBLE NULL DEFAULT 0,
    `trialDays` INTEGER NULL DEFAULT 0,
    `features` JSON NOT NULL,
    `quotas` JSON NOT NULL,
    `status` ENUM('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'PUBLISHED', 'SUSPENDED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    `creatorId` VARCHAR(191) NOT NULL,
    `platformCommission` DOUBLE NOT NULL DEFAULT 10.0,
    `creatorRevenue` DOUBLE NOT NULL DEFAULT 90.0,
    `images` JSON NULL,
    `tags` JSON NULL,
    `highlights` JSON NULL,
    `totalViews` INTEGER NOT NULL DEFAULT 0,
    `totalPurchases` INTEGER NOT NULL DEFAULT 0,
    `totalRevenue` DOUBLE NOT NULL DEFAULT 0,
    `averageRating` DOUBLE NULL,
    `totalReviews` INTEGER NOT NULL DEFAULT 0,
    `slug` VARCHAR(191) NULL,
    `metaTitle` VARCHAR(191) NULL,
    `metaDescription` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `packages_slug_key`(`slug`),
    INDEX `packages_creatorId_idx`(`creatorId`),
    INDEX `packages_status_idx`(`status`),
    INDEX `packages_category_idx`(`category`),
    INDEX `packages_isPublic_idx`(`isPublic`),
    INDEX `packages_isFeatured_idx`(`isFeatured`),
    INDEX `packages_slug_idx`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `package_purchases` (
    `id` VARCHAR(191) NOT NULL,
    `packageId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `purchasePrice` DOUBLE NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `billingCycle` ENUM('MONTHLY', 'QUARTERLY', 'YEARLY', 'ONE_TIME') NOT NULL,
    `status` ENUM('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELLED', 'SUSPENDED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
    `currentPeriodStart` DATETIME(3) NOT NULL,
    `currentPeriodEnd` DATETIME(3) NOT NULL,
    `cancelAtPeriodEnd` BOOLEAN NOT NULL DEFAULT false,
    `trialEnd` DATETIME(3) NULL,
    `paymentProvider` VARCHAR(191) NULL,
    `customerPaymentId` VARCHAR(191) NULL,
    `subscriptionPaymentId` VARCHAR(191) NULL,
    `quotas` JSON NOT NULL,
    `usage` JSON NOT NULL,
    `metadata` JSON NULL,
    `notes` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `package_purchases_packageId_idx`(`packageId`),
    INDEX `package_purchases_customerId_idx`(`customerId`),
    INDEX `package_purchases_status_idx`(`status`),
    INDEX `package_purchases_currentPeriodEnd_idx`(`currentPeriodEnd`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `package_sales` (
    `id` VARCHAR(191) NOT NULL,
    `packageId` VARCHAR(191) NOT NULL,
    `sellerId` VARCHAR(191) NOT NULL,
    `purchaseId` VARCHAR(191) NOT NULL,
    `totalAmount` DOUBLE NOT NULL,
    `platformCommission` DOUBLE NOT NULL,
    `sellerRevenue` DOUBLE NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `commissionStatus` ENUM('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'DISPUTED') NOT NULL DEFAULT 'PENDING',
    `commissionPaidAt` DATETIME(3) NULL,
    `paymentProvider` VARCHAR(191) NULL,
    `transactionId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `package_sales_purchaseId_key`(`purchaseId`),
    INDEX `package_sales_packageId_idx`(`packageId`),
    INDEX `package_sales_sellerId_idx`(`sellerId`),
    INDEX `package_sales_commissionStatus_idx`(`commissionStatus`),
    INDEX `package_sales_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `package_reviews` (
    `id` VARCHAR(191) NOT NULL,
    `packageId` VARCHAR(191) NOT NULL,
    `reviewerId` VARCHAR(191) NOT NULL,
    `rating` INTEGER NOT NULL,
    `title` VARCHAR(191) NULL,
    `content` LONGTEXT NULL,
    `status` ENUM('PENDING', 'PUBLISHED', 'HIDDEN', 'REJECTED') NOT NULL DEFAULT 'PUBLISHED',
    `isVerifiedPurchase` BOOLEAN NOT NULL DEFAULT false,
    `moderatedBy` VARCHAR(191) NULL,
    `moderatedAt` DATETIME(3) NULL,
    `moderationNotes` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `package_reviews_packageId_idx`(`packageId`),
    INDEX `package_reviews_reviewerId_idx`(`reviewerId`),
    INDEX `package_reviews_status_idx`(`status`),
    INDEX `package_reviews_rating_idx`(`rating`),
    UNIQUE INDEX `package_reviews_packageId_reviewerId_key`(`packageId`, `reviewerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `package_analytics` (
    `id` VARCHAR(191) NOT NULL,
    `packageId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `views` INTEGER NOT NULL DEFAULT 0,
    `uniqueViews` INTEGER NOT NULL DEFAULT 0,
    `purchases` INTEGER NOT NULL DEFAULT 0,
    `revenue` DOUBLE NOT NULL DEFAULT 0,
    `conversionRate` DOUBLE NOT NULL DEFAULT 0,
    `trafficSources` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `package_analytics_packageId_idx`(`packageId`),
    INDEX `package_analytics_date_idx`(`date`),
    UNIQUE INDEX `package_analytics_packageId_date_key`(`packageId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `package_templates` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` LONGTEXT NULL,
    `category` ENUM('EMAIL_MARKETING', 'AUTOMATION', 'ANALYTICS', 'INTEGRATIONS', 'TEMPLATES', 'CUSTOM') NOT NULL,
    `templateData` JSON NOT NULL,
    `features` JSON NOT NULL,
    `quotas` JSON NOT NULL,
    `suggestedPrice` DOUBLE NULL,
    `priceRange` JSON NULL,
    `isOfficial` BOOLEAN NOT NULL DEFAULT false,
    `usageCount` INTEGER NOT NULL DEFAULT 0,
    `packageId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `package_templates_category_idx`(`category`),
    INDEX `package_templates_isOfficial_idx`(`isOfficial`),
    INDEX `package_templates_packageId_idx`(`packageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `package_invoices` (
    `id` VARCHAR(191) NOT NULL,
    `purchaseId` VARCHAR(191) NOT NULL,
    `invoiceNumber` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `subtotal` DOUBLE NOT NULL,
    `taxAmount` DOUBLE NOT NULL DEFAULT 0,
    `discountAmount` DOUBLE NOT NULL DEFAULT 0,
    `total` DOUBLE NOT NULL,
    `amountPaid` DOUBLE NOT NULL DEFAULT 0,
    `amountDue` DOUBLE NOT NULL,
    `issueDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dueDate` DATETIME(3) NOT NULL,
    `paidAt` DATETIME(3) NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `lineItems` JSON NOT NULL,
    `billingAddress` JSON NULL,
    `paymentProvider` VARCHAR(191) NULL,
    `providerInvoiceId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `package_invoices_invoiceNumber_key`(`invoiceNumber`),
    INDEX `package_invoices_purchaseId_idx`(`purchaseId`),
    INDEX `package_invoices_status_idx`(`status`),
    INDEX `package_invoices_dueDate_idx`(`dueDate`),
    INDEX `package_invoices_invoiceNumber_idx`(`invoiceNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `package_usage_history` (
    `id` VARCHAR(191) NOT NULL,
    `purchaseId` VARCHAR(191) NOT NULL,
    `resourceType` VARCHAR(191) NOT NULL,
    `usageAmount` INTEGER NOT NULL,
    `quotaLimit` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `isOverage` BOOLEAN NOT NULL DEFAULT false,
    `overageAmount` INTEGER NOT NULL DEFAULT 0,
    `overageCharge` DOUBLE NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `package_usage_history_purchaseId_idx`(`purchaseId`),
    INDEX `package_usage_history_resourceType_idx`(`resourceType`),
    INDEX `package_usage_history_date_idx`(`date`),
    INDEX `package_usage_history_isOverage_idx`(`isOverage`),
    UNIQUE INDEX `package_usage_history_purchaseId_resourceType_date_key`(`purchaseId`, `resourceType`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
