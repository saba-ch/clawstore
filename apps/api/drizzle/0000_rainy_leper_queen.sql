CREATE TABLE `accounts` (
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
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `accounts_userId_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon` text NOT NULL,
	`sort_order` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `device_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`device_code` text NOT NULL,
	`user_code` text NOT NULL,
	`user_id` text,
	`expires_at` integer NOT NULL,
	`status` text NOT NULL,
	`last_polled_at` integer,
	`polling_interval` integer,
	`client_id` text,
	`scope` text
);
--> statement-breakpoint
CREATE TABLE `package_tags` (
	`package_id` text NOT NULL,
	`tag` text NOT NULL,
	PRIMARY KEY(`package_id`, `tag`),
	FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `package_tags_tag_idx` ON `package_tags` (`tag`);--> statement-breakpoint
CREATE TABLE `packages` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`name` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`latest_version_id` text,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`tagline` text NOT NULL,
	`display_name` text NOT NULL,
	`homepage` text,
	`repository` text,
	`license` text NOT NULL,
	`download_count` integer DEFAULT 0 NOT NULL,
	`avg_rating` real,
	`review_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `packages_scope_name_idx` ON `packages` (`scope`,`name`);--> statement-breakpoint
CREATE INDEX `packages_scope_idx` ON `packages` (`scope`);--> statement-breakpoint
CREATE INDEX `packages_name_idx` ON `packages` (`name`);--> statement-breakpoint
CREATE INDEX `packages_category_idx` ON `packages` (`category`);--> statement-breakpoint
CREATE INDEX `packages_owner_idx` ON `packages` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `packages_updated_at_idx` ON `packages` (`updated_at`);--> statement-breakpoint
CREATE INDEX `packages_display_name_idx` ON `packages` (`display_name`);--> statement-breakpoint
CREATE INDEX `packages_tagline_idx` ON `packages` (`tagline`);--> statement-breakpoint
CREATE INDEX `packages_download_count_idx` ON `packages` (`download_count`);--> statement-breakpoint
CREATE INDEX `packages_avg_rating_idx` ON `packages` (`avg_rating`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`bio` text,
	`website` text,
	`location` text,
	`github_login` text NOT NULL,
	`avatar_url` text,
	`display_name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_github_login_unique` ON `profiles` (`github_login`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`version_id` text,
	`reporter_user_id` text,
	`reporter_ip_hash` text NOT NULL,
	`reason` text NOT NULL,
	`details` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`resolved_by_user_id` text,
	`resolved_at` integer,
	`resolution_notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`version_id`) REFERENCES `versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reporter_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resolved_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reports_status_created_idx` ON `reports` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `reports_package_id_idx` ON `reports` (`package_id`);--> statement-breakpoint
CREATE INDEX `reports_ip_hash_idx` ON `reports` (`reporter_ip_hash`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`reviewer_user_id` text NOT NULL,
	`rating` integer NOT NULL,
	`title` text,
	`body` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_package_user_idx` ON `reviews` (`package_id`,`reviewer_user_id`);--> statement-breakpoint
CREATE INDEX `reviews_package_id_idx` ON `reviews` (`package_id`);--> statement-breakpoint
CREATE INDEX `reviews_reviewer_idx` ON `reviews` (`reviewer_user_id`);--> statement-breakpoint
CREATE INDEX `reviews_package_created_idx` ON `reviews` (`package_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE INDEX `sessions_userId_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verifications_identifier_idx` ON `verifications` (`identifier`);--> statement-breakpoint
CREATE TABLE `version_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`version_id` text NOT NULL,
	`kind` text NOT NULL,
	`path` text NOT NULL,
	`r2_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`ordering` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`version_id`) REFERENCES `versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `version_assets_version_kind_idx` ON `version_assets` (`version_id`,`kind`);--> statement-breakpoint
CREATE TABLE `versions` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`version` text NOT NULL,
	`channel` text NOT NULL,
	`manifest` text NOT NULL,
	`tarball_r2_key` text NOT NULL,
	`tarball_sha256` text NOT NULL,
	`tarball_size_bytes` integer NOT NULL,
	`download_count` integer DEFAULT 0 NOT NULL,
	`uploaded_by_user_id` text NOT NULL,
	`uploaded_at` integer DEFAULT (unixepoch()) NOT NULL,
	`yanked_at` integer,
	`yanked_by_user_id` text,
	`yanked_reason` text,
	FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`yanked_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `versions_package_version_idx` ON `versions` (`package_id`,`version`);--> statement-breakpoint
CREATE INDEX `versions_package_uploaded_idx` ON `versions` (`package_id`,`uploaded_at`);--> statement-breakpoint
CREATE INDEX `versions_yanked_at_idx` ON `versions` (`yanked_at`);