ALTER TABLE `Consultation`
    ADD COLUMN `shift` ENUM('MORNING', 'AFTERNOON') NULL,
    ADD INDEX `Consultation_shift_occurredAt_idx`(`shift`, `occurredAt`);

ALTER TABLE `Vaccine`
    ADD COLUMN `shift` ENUM('MORNING', 'AFTERNOON') NULL,
    ADD INDEX `Vaccine_shift_administeredAt_idx`(`shift`, `administeredAt`);

ALTER TABLE `Treatment`
    ADD COLUMN `shift` ENUM('MORNING', 'AFTERNOON') NULL,
    ADD INDEX `Treatment_shift_startsAt_idx`(`shift`, `startsAt`);

ALTER TABLE `Appointment`
    ADD COLUMN `shift` ENUM('MORNING', 'AFTERNOON') NULL,
    ADD INDEX `Appointment_shift_startsAt_idx`(`shift`, `startsAt`);
