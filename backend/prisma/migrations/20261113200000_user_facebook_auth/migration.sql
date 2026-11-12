-- Kolom login Facebook yang dipakai social-auth.service (sebelumnya tidak ada → login FB error)
ALTER TABLE `users`
    ADD COLUMN `facebookId` VARCHAR(191) NULL,
    ADD COLUMN `facebookAccessToken` TEXT NULL,
    ADD COLUMN `authProvider` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `users_facebookId_key` ON `users`(`facebookId`);
