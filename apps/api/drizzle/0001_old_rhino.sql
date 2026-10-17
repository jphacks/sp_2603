CREATE TABLE `room` (
	`id` text PRIMARY KEY NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `room_member` (
	`user_id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`room_id`) REFERENCES `room`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `room_member_room_id_joined_at_idx` ON `room_member` (`room_id`,`joined_at`);--> statement-breakpoint
CREATE TABLE `task` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`weight` integer NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	`dropped_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "task_title_not_blank" CHECK(length(trim(title)) > 0),
	CONSTRAINT "task_weight_range" CHECK(weight between 1 and 100),
	CONSTRAINT "task_state_dropped_at" CHECK((state = 'on' and dropped_at is null) or (state = 'dropped' and dropped_at is not null))
);
--> statement-breakpoint
CREATE INDEX `task_user_id_state_dropped_at_idx` ON `task` (`user_id`,`state`,`dropped_at`);--> statement-breakpoint
CREATE TABLE `user_status` (
	`user_id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
