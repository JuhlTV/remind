-- Bewerbungsportal - SQL Setup für phpMyAdmin
-- Kopiere diesen Code in phpMyAdmin SQL Tab und führe ihn aus

-- Tabelle: admins (für Admin-Authentifizierung)
CREATE TABLE IF NOT EXISTS `admins` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL UNIQUE,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci,
  `role` enum('website_owner','projektleitung','hr_manager','reviewer','analyst','observer','support') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'reviewer',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabelle: applications (für Bewerbungen)
CREATE TABLE IF NOT EXISTS `applications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `discord` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `age` int NOT NULL,
  `experience` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `motivation` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `evidence_original_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `evidence_stored_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `evidence_mime_type` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `evidence_size` int DEFAULT NULL,
  `status` enum('pending','accepted','rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `admin_notes` longtext COLLATE utf8mb4_unicode_ci,
  `reviewed_at` timestamp NULL,
  `reviewed_by` int,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  KEY `reviewed_by` (`reviewed_by`),
  CONSTRAINT `applications_ibfk_1` FOREIGN KEY (`reviewed_by`) REFERENCES `admins` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabelle: application_review_history (Audit-Trail pro Bewerbungsentscheidung)
CREATE TABLE IF NOT EXISTS `application_review_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `application_id` int NOT NULL,
  `old_status` enum('pending','accepted','rejected') COLLATE utf8mb4_unicode_ci NOT NULL,
  `new_status` enum('pending','accepted','rejected') COLLATE utf8mb4_unicode_ci NOT NULL,
  `old_admin_notes` longtext COLLATE utf8mb4_unicode_ci,
  `new_admin_notes` longtext COLLATE utf8mb4_unicode_ci,
  `action_type` enum('review','undo','bulk_review') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'review',
  `changed_by` int DEFAULT NULL,
  `changed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `undone_by` int DEFAULT NULL,
  `undone_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_history_application` (`application_id`),
  KEY `idx_history_changed_at` (`changed_at`),
  KEY `idx_history_changed_by` (`changed_by`),
  CONSTRAINT `history_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `history_changed_by_fk` FOREIGN KEY (`changed_by`) REFERENCES `admins` (`id`) ON DELETE SET NULL,
  CONSTRAINT `history_undone_by_fk` FOREIGN KEY (`undone_by`) REFERENCES `admins` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabelle: application_activity_log (bereichsweites Activity-Log)
CREATE TABLE IF NOT EXISTS `application_activity_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `application_id` int DEFAULT NULL,
  `activity_type` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `details` longtext COLLATE utf8mb4_unicode_ci,
  `actor_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_activity_created_at` (`created_at`),
  KEY `idx_activity_application` (`application_id`),
  KEY `idx_activity_actor` (`actor_id`),
  CONSTRAINT `activity_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE SET NULL,
  CONSTRAINT `activity_actor_fk` FOREIGN KEY (`actor_id`) REFERENCES `admins` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Info: Nachdem die Tabellen erstellt wurden, kannst du den ersten Admin per Script erstellen:
-- npm run create-admin -- <username> <passwort> <rolle>
-- 
-- Rollen: website_owner | projektleitung | hr_manager | reviewer | analyst | observer | support
--
-- Um einen Admin manuell zu erstellen (nur für Development!):
-- INSERT INTO admins (username, password_hash) 
-- VALUES ('admin', '$2a$10$...', 'website_owner');
-- 
-- BESSER: Nutze: npm run create-admin
