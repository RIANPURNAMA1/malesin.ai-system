-- CreateTable
CREATE TABLE `ai_agents` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `provider` ENUM('OPENAI', 'ANTHROPIC', 'GOOGLE', 'GROQ') NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `apiKey` TEXT NOT NULL,
    `systemPrompt` TEXT NULL,
    `temperature` DOUBLE NOT NULL DEFAULT 0.7,
    `maxTokens` INTEGER NOT NULL DEFAULT 1024,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ai_agents_companyId_idx` ON `ai_agents`(`companyId`);

-- AddForeignKey
ALTER TABLE `ai_agents` ADD CONSTRAINT `ai_agents_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
