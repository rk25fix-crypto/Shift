PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_swap_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`date` text NOT NULL,
	`from_staff_id` text NOT NULL,
	`to_staff_id` text NOT NULL,
	`from_shift_type_id` text,
	`to_shift_type_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_by` text,
	`decided_by` text,
	`decided_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_shift_type_id`) REFERENCES `shift_types`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`to_shift_type_id`) REFERENCES `shift_types`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "swap_requests_status_check" CHECK("__new_swap_requests"."status" in ('pending', 'approved', 'rejected'))
);
--> statement-breakpoint
INSERT INTO `__new_swap_requests`("id", "organization_id", "date", "from_staff_id", "to_staff_id", "from_shift_type_id", "to_shift_type_id", "status", "requested_by", "decided_by", "decided_at", "created_at") SELECT "id", "organization_id", "date", "from_staff_id", "to_staff_id", "from_shift_type_id", "to_shift_type_id", "status", "requested_by", "decided_by", "decided_at", "created_at" FROM `swap_requests`;--> statement-breakpoint
DROP TABLE `swap_requests`;--> statement-breakpoint
ALTER TABLE `__new_swap_requests` RENAME TO `swap_requests`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `swap_requests_org_date_idx` ON `swap_requests` (`organization_id`,`date`);