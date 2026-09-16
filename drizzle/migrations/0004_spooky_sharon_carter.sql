CREATE TABLE `staff_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`claimed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `staff_invites_staff_idx` ON `staff_invites` (`staff_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `staff_invites_token_unique` ON `staff_invites` (`token`);--> statement-breakpoint
CREATE TABLE `staff_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `staff_sessions_staff_idx` ON `staff_sessions` (`staff_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `staff_sessions_token_unique` ON `staff_sessions` (`token`);