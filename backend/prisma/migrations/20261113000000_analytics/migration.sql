-- Analytics: serah terima AI → agen + pengaturan company (target SLA)
ALTER TABLE `conversations` ADD COLUMN `handedToHumanAt` DATETIME(3) NULL;
ALTER TABLE `companies` ADD COLUMN `settings` JSON NULL;

-- Backfill: balasan agen pertama dianggap waktu serah terima.
UPDATE `conversations` c
SET c.`handedToHumanAt` = (
    SELECT MIN(m.`sentAt`) FROM `messages` m
    WHERE m.`conversationId` = c.`id` AND m.`direction` = 'OUTBOUND' AND m.`senderId` IS NOT NULL
)
WHERE c.`handedToHumanAt` IS NULL AND c.`handledBy` = 'HUMAN';
