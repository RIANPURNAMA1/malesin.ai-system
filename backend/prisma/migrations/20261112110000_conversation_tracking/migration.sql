-- AlterTable: metrik percakapan (waktu respons pertama, penutupan, penanganan AI/manusia)
ALTER TABLE `conversations`
    ADD COLUMN `firstResponseAt` DATETIME(3) NULL,
    ADD COLUMN `closedAt` DATETIME(3) NULL,
    ADD COLUMN `closedById` VARCHAR(191) NULL,
    ADD COLUMN `handledBy` VARCHAR(191) NULL;

CREATE INDEX `conversations_createdAt_idx` ON `conversations`(`createdAt`);

-- Backfill: percakapan yang sudah CLOSED dianggap ditutup pada update terakhir.
UPDATE `conversations` SET `closedAt` = `updatedAt` WHERE `status` = 'CLOSED' AND `closedAt` IS NULL;

-- Backfill: respons pertama = pesan keluar paling awal; HUMAN bila ada balasan agen.
UPDATE `conversations` c
SET c.`firstResponseAt` = (
    SELECT MIN(m.`sentAt`) FROM `messages` m
    WHERE m.`conversationId` = c.`id` AND m.`direction` = 'OUTBOUND'
)
WHERE c.`firstResponseAt` IS NULL;

UPDATE `conversations` c
SET c.`handledBy` = 'HUMAN'
WHERE c.`handledBy` IS NULL AND EXISTS (
    SELECT 1 FROM `messages` m
    WHERE m.`conversationId` = c.`id` AND m.`direction` = 'OUTBOUND' AND m.`senderId` IS NOT NULL
);
