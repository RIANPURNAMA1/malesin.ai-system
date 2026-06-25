-- AlterTable: Add sessionData column to channels
ALTER TABLE `channels` ADD COLUMN `sessionData` TEXT NULL;

-- AlterTable: Add WHATSAPP_UNOFFICIAL to channels type enum
ALTER TABLE `channels` MODIFY COLUMN `type` ENUM('WHATSAPP', 'WHATSAPP_UNOFFICIAL', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK') NOT NULL;
