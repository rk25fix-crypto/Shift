PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text,
	`diff` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "audit_log_action_check" CHECK("__new_audit_log"."action" in ('create', 'update', 'delete')),
	CONSTRAINT "audit_log_entity_check" CHECK("__new_audit_log"."entity" in ('staff', 'shift_type', 'shift_assignment'))
);
--> statement-breakpoint
INSERT INTO `__new_audit_log`("id", "organization_id", "actor_id", "action", "entity", "entity_id", "diff", "created_at") SELECT "id", "organization_id", "actor_id", "action", "entity", "entity_id", "diff", "created_at" FROM `audit_log`;--> statement-breakpoint
DROP TABLE `audit_log`;--> statement-breakpoint
ALTER TABLE `__new_audit_log` RENAME TO `audit_log`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `audit_log_org_created_idx` ON `audit_log` (`organization_id`,`created_at`);