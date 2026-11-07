CREATE TABLE `Prescription` (
    `id` VARCHAR(30) NOT NULL,
    `consultationId` VARCHAR(30) NOT NULL,
    `petId` VARCHAR(30) NOT NULL,
    `ownerId` VARCHAR(30) NOT NULL,
    `authorId` VARCHAR(30) NOT NULL,
    `data` JSON NOT NULL,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Prescription_consultationId_key`(`consultationId`),
    INDEX `Prescription_petId_generatedAt_idx`(`petId`, `generatedAt`),
    INDEX `Prescription_ownerId_generatedAt_idx`(`ownerId`, `generatedAt`),
    INDEX `Prescription_authorId_generatedAt_idx`(`authorId`, `generatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Prescription`
    ADD CONSTRAINT `Prescription_consultationId_fkey`
    FOREIGN KEY (`consultationId`) REFERENCES `Consultation`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Prescription`
    ADD CONSTRAINT `Prescription_petId_fkey`
    FOREIGN KEY (`petId`) REFERENCES `Pet`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Prescription`
    ADD CONSTRAINT `Prescription_ownerId_fkey`
    FOREIGN KEY (`ownerId`) REFERENCES `Owner`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Prescription`
    ADD CONSTRAINT `Prescription_authorId_fkey`
    FOREIGN KEY (`authorId`) REFERENCES `User`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
