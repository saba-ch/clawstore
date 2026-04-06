CREATE TABLE `api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`last_used_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_token_hash_unique` ON `api_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `api_tokens_user_id_idx` ON `api_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon` text NOT NULL,
	`sort_order` integer NOT NULL
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
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false,
	`image` text,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
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