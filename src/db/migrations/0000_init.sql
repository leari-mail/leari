CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`color` text NOT NULL,
	`auth_type` text NOT NULL,
	`username` text NOT NULL,
	`incoming_protocol` text NOT NULL,
	`incoming_host` text NOT NULL,
	`incoming_port` integer NOT NULL,
	`incoming_security` text NOT NULL,
	`smtp_host` text NOT NULL,
	`smtp_port` integer NOT NULL,
	`smtp_security` text NOT NULL,
	`signature` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`sync_enabled` integer DEFAULT true NOT NULL,
	`last_synced_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_email_unique` ON `accounts` (`email`);--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`content_id` text,
	`is_inline` integer DEFAULT false NOT NULL,
	`local_path` text,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mailboxes` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`path` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'custom' NOT NULL,
	`delimiter` text,
	`unread_count` integer DEFAULT 0 NOT NULL,
	`total_count` integer DEFAULT 0 NOT NULL,
	`uid_validity` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mailboxes_account_idx` ON `mailboxes` (`account_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `mailboxes_account_path_unique` ON `mailboxes` (`account_id`,`path`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`mailbox_id` text NOT NULL,
	`uid` integer,
	`message_id_header` text,
	`thread_id` text,
	`in_reply_to` text,
	`subject` text DEFAULT '' NOT NULL,
	`from_name` text,
	`from_address` text NOT NULL,
	`to` text DEFAULT '[]' NOT NULL,
	`cc` text DEFAULT '[]' NOT NULL,
	`bcc` text DEFAULT '[]' NOT NULL,
	`reply_to` text DEFAULT '[]' NOT NULL,
	`snippet` text DEFAULT '' NOT NULL,
	`body_text` text,
	`body_html` text,
	`date` integer NOT NULL,
	`size` integer,
	`is_read` integer DEFAULT false NOT NULL,
	`is_starred` integer DEFAULT false NOT NULL,
	`is_draft` integer DEFAULT false NOT NULL,
	`has_attachments` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messages_mailbox_date_idx` ON `messages` (`mailbox_id`,`date`);--> statement-breakpoint
CREATE INDEX `messages_account_date_idx` ON `messages` (`account_id`,`date`);--> statement-breakpoint
CREATE INDEX `messages_thread_idx` ON `messages` (`thread_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `messages_mailbox_uid_unique` ON `messages` (`mailbox_id`,`uid`);