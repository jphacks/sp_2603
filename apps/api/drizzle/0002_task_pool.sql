-- 列の名前を変えると drizzle-kit generate が対話で確認を求めるので、`--custom` で作って SQL を手で書いた。
ALTER TABLE `user_status` RENAME COLUMN `updated_at` TO `last_seen_at`;--> statement-breakpoint
-- 落としたタスクの履歴はなくすので消す。CHECK 制約が変わるので task は作り直す。
DELETE FROM `task` WHERE `state` = 'dropped';--> statement-breakpoint
CREATE TABLE `__new_task` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`weight` integer NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	`loaded_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "task_title_not_blank" CHECK(length(trim(title)) > 0),
	CONSTRAINT "task_weight_range" CHECK(weight between 1 and 100),
	CONSTRAINT "task_state_loaded_at" CHECK((state = 'pool' and loaded_at is null) or (state = 'on' and loaded_at is not null))
);
--> statement-breakpoint
-- これまでの created_at は乗せた日時だったので、loaded_at にも同じ値を入れる。
INSERT INTO `__new_task` (`id`, `user_id`, `title`, `weight`, `state`, `created_at`, `loaded_at`)
SELECT `id`, `user_id`, `title`, `weight`, `state`, `created_at`, `created_at` FROM `task`;--> statement-breakpoint
DROP TABLE `task`;--> statement-breakpoint
ALTER TABLE `__new_task` RENAME TO `task`;--> statement-breakpoint
CREATE INDEX `task_user_id_state_idx` ON `task` (`user_id`,`state`);
