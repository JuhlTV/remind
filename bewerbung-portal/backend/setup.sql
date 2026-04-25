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
