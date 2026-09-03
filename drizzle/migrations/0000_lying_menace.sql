CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text,
	`diff` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_log_org_created_idx` ON `audit_log` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "memberships_role_check" CHECK("memberships"."role" in ('owner', 'admin', 'staff'))
);
--> statement-breakpoint
CREATE INDEX `memberships_user_org_idx` ON `memberships` (`user_id`,`organization_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_org_user_unique` ON `memberships` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`business_type` text,
	`timezone` text DEFAULT 'Asia/Tokyo' NOT NULL,
	`max_consecutive_days` integer DEFAULT 6 NOT NULL,
	`max_weekly_hours` integer DEFAULT 40 NOT NULL,
	`max_monthly_hours` integer DEFAULT 160 NOT NULL,
	`min_break_minutes_over_6h` integer DEFAULT 45 NOT NULL,
	`min_break_minutes_over_8h` integer DEFAULT 60 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shift_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`shift_type_id` text NOT NULL,
	`date` text NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`created_by` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shift_type_id`) REFERENCES `shift_types`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "shift_assignments_status_check" CHECK("shift_assignments"."status" in ('draft', 'confirmed'))
);
--> statement-breakpoint
CREATE INDEX `shift_assignments_org_date_idx` ON `shift_assignments` (`organization_id`,`date`);--> statement-breakpoint
CREATE INDEX `shift_assignments_staff_date_idx` ON `shift_assignments` (`staff_id`,`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `shift_assignments_staff_date_type_unique` ON `shift_assignments` (`staff_id`,`date`,`shift_type_id`);--> statement-breakpoint
CREATE TABLE `shift_types` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`crosses_midnight` integer DEFAULT false NOT NULL,
	`break_minutes` integer DEFAULT 0 NOT NULL,
	`is_required` integer DEFAULT false NOT NULL,
	`is_balanced` integer DEFAULT false NOT NULL,
	`color_key` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shift_types_org_idx` ON `shift_types` (`organization_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `shift_types_org_code_unique` ON `shift_types` (`organization_id`,`code`);--> statement-breakpoint
CREATE TABLE `staff` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`role_label` text,
	`fixed_days_off` text DEFAULT '[]' NOT NULL,
	`unavailable_shift_type_ids` text DEFAULT '[]' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `staff_org_idx` ON `staff` (`organization_id`);--> statement-breakpoint
CREATE TABLE `staff_compensation` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`hourly_wage` integer NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_compensation_staff_id_unique` ON `staff_compensation` (`staff_id`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`stripe_event_id` text,
	`plan` text DEFAULT 'trial' NOT NULL,
	`status` text DEFAULT 'trialing' NOT NULL,
	`trial_ends_at` integer,
	`current_period_end` integer,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_organization_id_unique` ON `subscriptions` (`organization_id`);--> statement-breakpoint
CREATE TABLE `swap_requests` (
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
	FOREIGN KEY (`from_shift_type_id`) REFERENCES `shift_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_shift_type_id`) REFERENCES `shift_types`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "swap_requests_status_check" CHECK("swap_requests"."status" in ('pending', 'approved', 'rejected'))
);
--> statement-breakpoint
CREATE INDEX `swap_requests_org_date_idx` ON `swap_requests` (`organization_id`,`date`);--> statement-breakpoint
CREATE TABLE `time_off_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`date` text NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "time_off_requests_status_check" CHECK("time_off_requests"."status" in ('requested', 'acknowledged'))
);
--> statement-breakpoint
CREATE INDEX `time_off_requests_org_idx` ON `time_off_requests` (`organization_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `time_off_requests_staff_date_unique` ON `time_off_requests` (`staff_id`,`date`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
