-- AlterTable: add description to ai_agents
ALTER TABLE `ai_agents` ADD COLUMN `description` TEXT NULL;

-- CreateTable: ai_knowledge (knowledge base untuk RAG)
CREATE TABLE `ai_knowledge` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `aiAgentId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ai_knowledge_companyId_idx` ON `ai_knowledge`(`companyId`);

-- CreateIndex
CREATE INDEX `ai_knowledge_aiAgentId_idx` ON `ai_knowledge`(`aiAgentId`);

-- AddForeignKey
ALTER TABLE `ai_knowledge` ADD CONSTRAINT `ai_knowledge_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_knowledge` ADD CONSTRAINT `ai_knowledge_aiAgentId_fkey` FOREIGN KEY (`aiAgentId`) REFERENCES `ai_agents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
