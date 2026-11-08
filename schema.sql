-- Easiest way: run  npm run setup  (it does all of this for you).
-- Manual way: phpMyAdmin -> click database "bad" -> SQL tab -> paste -> Go

CREATE DATABASE IF NOT EXISTS bad;
USE bad;

-- Option A: users table already exists
ALTER TABLE users
  ADD COLUMN role ENUM('admin','user','manager') NOT NULL DEFAULT 'user',
  ADD COLUMN department VARCHAR(50) NOT NULL DEFAULT 'general',
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1,
  MODIFY fname VARCHAR(100) NULL,
  MODIFY lname VARCHAR(100) NULL,
  MODIFY email VARCHAR(150) NULL,
  MODIFY password VARCHAR(255) NOT NULL,
  ADD UNIQUE KEY uq_users_username (username);

-- Option B: no users table yet (use this INSTEAD of option A)
-- CREATE TABLE users (
--   id INT AUTO_INCREMENT PRIMARY KEY,
--   fname VARCHAR(100) NULL,
--   lname VARCHAR(100) NULL,
--   username VARCHAR(100) NOT NULL UNIQUE,
--   email VARCHAR(150) NULL,
--   password VARCHAR(255) NOT NULL,
--   role ENUM('admin','user','manager') NOT NULL DEFAULT 'user',
--   department VARCHAR(50) NOT NULL DEFAULT 'general',
--   is_active TINYINT(1) NOT NULL DEFAULT 1
-- );
