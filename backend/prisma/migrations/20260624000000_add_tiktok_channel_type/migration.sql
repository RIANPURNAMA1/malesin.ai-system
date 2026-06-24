-- AlterTable: Add TIKTOK to channels type enum
ALTER TABLE `channels` MODIFY COLUMN `type` ENUM('WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK') NOT NULL;
