-- Munchwa database schema + seed data
-- Import via phpMyAdmin > Import

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS `munchwa`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;

USE `munchwa`;

DROP TABLE IF EXISTS `entries`;

CREATE TABLE `entries` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(255) NOT NULL,
  `chapters` INT UNSIGNED NOT NULL DEFAULT 0,
  `status` ENUM('reading','completed','planned','dropped') NOT NULL DEFAULT 'reading',
  `rating` TINYINT UNSIGNED DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `chk_rating` CHECK (`rating` IS NULL OR `rating` BETWEEN 0 AND 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `entries` (`title`, `chapters`, `status`, `rating`, `notes`) VALUES
('Solo Leveling', 179, 'completed', 10, 'Peak power fantasy. Reread someday.');
