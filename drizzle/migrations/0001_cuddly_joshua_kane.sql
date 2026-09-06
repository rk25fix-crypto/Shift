ALTER TABLE `shift_types` ADD COLUMN `required_count` integer DEFAULT 1 NOT NULL CONSTRAINT "shift_types_required_count_check" CHECK("required_count" >= 1);
