-- CreateTable: ai_knowledge_media (gambar yang menempel pada knowledge base)
CREATE TABLE `ai_knowledge_media` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `knowledgeId` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `storagePath` TEXT NOT NULL,
    `publicUrl` TEXT NOT NULL,
    `altText` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ai_knowledge_media_companyId_idx` ON `ai_knowledge_media`(`companyId`);

-- CreateIndex
CREATE INDEX `ai_knowledge_media_knowledgeId_idx` ON `ai_knowledge_media`(`knowledgeId`);

-- AddForeignKey
ALTER TABLE `ai_knowledge_media` ADD CONSTRAINT `ai_knowledge_media_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_knowledge_media` ADD CONSTRAINT `ai_knowledge_media_knowledgeId_fkey` FOREIGN KEY (`knowledgeId`) REFERENCES `ai_knowledge`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
