CREATE TABLE `EuthanasiaAuthorization` (
    `id` VARCHAR(30) NOT NULL,
    `petId` VARCHAR(30) NOT NULL,
    `ownerId` VARCHAR(30) NOT NULL,
    `authorId` VARCHAR(30) NOT NULL,
    `data` JSON NOT NULL,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EuthanasiaAuthorization_petId_generatedAt_idx`(`petId`, `generatedAt`),
    INDEX `EuthanasiaAuthorization_ownerId_generatedAt_idx`(`ownerId`, `generatedAt`),
    INDEX `EuthanasiaAuthorization_authorId_generatedAt_idx`(`authorId`, `generatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `EuthanasiaAuthorization`
    ADD CONSTRAINT `EuthanasiaAuthorization_petId_fkey`
    FOREIGN KEY (`petId`) REFERENCES `Pet`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `EuthanasiaAuthorization`
    ADD CONSTRAINT `EuthanasiaAuthorization_ownerId_fkey`
    FOREIGN KEY (`ownerId`) REFERENCES `Owner`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `EuthanasiaAuthorization`
    ADD CONSTRAINT `EuthanasiaAuthorization_authorId_fkey`
    FOREIGN KEY (`authorId`) REFERENCES `User`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
