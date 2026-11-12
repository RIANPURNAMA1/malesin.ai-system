-- CreateTable: ai_media (media/gambar untuk balasan AI Agent)
CREATE TABLE `ai_media` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `aiAgentId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `mediaUrl` TEXT NOT NULL,
    `caption` TEXT NULL,
    `description` TEXT NULL,
    `keywords` TEXT NULL,
    `trigger` ENUM('KEYWORD', 'AI') NOT NULL DEFAULT 'KEYWORD',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ai_media_companyId_idx` ON `ai_media`(`companyId`);

-- CreateIndex
CREATE INDEX `ai_media_aiAgentId_idx` ON `ai_media`(`aiAgentId`);

-- AddForeignKey
ALTER TABLE `ai_media` ADD CONSTRAINT `ai_media_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_media` ADD CONSTRAINT `ai_media_aiAgentId_fkey` FOREIGN KEY (`aiAgentId`) REFERENCES `ai_agents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
