-- AlterTable: perilaku AI Agent (welcome message, komunikasi inti, instruksi tambahan)
ALTER TABLE `ai_agents`
    ADD COLUMN `welcomeMessage` TEXT NULL,
    ADD COLUMN `communicationStyle` TEXT NULL,
    ADD COLUMN `conversationFlow` TEXT NULL,
    ADD COLUMN `communicationRules` TEXT NULL,
    ADD COLUMN `additionalInstructions` JSON NULL,
    ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;
