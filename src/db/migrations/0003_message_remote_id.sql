ALTER TABLE `messages` ADD `remote_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `messages_mailbox_remote_id_unique` ON `messages` (`mailbox_id`,`remote_id`);