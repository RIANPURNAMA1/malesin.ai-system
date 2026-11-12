-- CreateTable: campaign broadcast + penerima (Broadcast Protection & Compliance Engine)
CREATE TABLE `broadcasts` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `channelId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `mediaUrl` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `audience` JSON NULL,
    `settings` JSON NULL,
    `scheduledAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `pauseReason` TEXT NULL,
    `totalRecipients` INTEGER NOT NULL DEFAULT 0,
    `sentCount` INTEGER NOT NULL DEFAULT 0,
    `failedCount` INTEGER NOT NULL DEFAULT 0,
    `skippedCount` INTEGER NOT NULL DEFAULT 0,
    `repliedCount` INTEGER NOT NULL DEFAULT 0,
    `optOutCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `broadcasts_companyId_idx`(`companyId`),
    INDEX `broadcasts_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `broadcast_recipients` (
    `id` VARCHAR(191) NOT NULL,
    `broadcastId` VARCHAR(191) NOT NULL,
    `contactId` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `error` TEXT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `sentAt` DATETIME(3) NULL,
    `repliedAt` DATETIME(3) NULL,
    `optedOutAt` DATETIME(3) NULL,

    UNIQUE INDEX `broadcast_recipients_broadcastId_contactId_key`(`broadcastId`, `contactId`),
    INDEX `broadcast_recipients_contactId_sentAt_idx`(`contactId`, `sentAt`),
    INDEX `broadcast_recipients_broadcastId_status_idx`(`broadcastId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `broadcasts` ADD CONSTRAINT `broadcasts_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `broadcasts` ADD CONSTRAINT `broadcasts_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `channels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `broadcast_recipients` ADD CONSTRAINT `broadcast_recipients_broadcastId_fkey` FOREIGN KEY (`broadcastId`) REFERENCES `broadcasts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `broadcast_recipients` ADD CONSTRAINT `broadcast_recipients_contactId_fkey` FOREIGN KEY (`contactId`) REFERENCES `contacts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
