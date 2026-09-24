-- ================================================================
-- Student Management System — MySQL Schema
-- Run ONCE to create the database and students table
-- ================================================================

CREATE DATABASE IF NOT EXISTS student_management
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE student_management;

CREATE TABLE IF NOT EXISTS students (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(120) NOT NULL,
  roll_number     VARCHAR(20)  NOT NULL,
  class           VARCHAR(10)  NOT NULL,
  section         VARCHAR(5)   NOT NULL,
  blood_group     VARCHAR(5),
  dob             DATE,
  parent_name     VARCHAR(120) NOT NULL,
  parent_mobile   VARCHAR(15)  NOT NULL,
  address         TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Prevent duplicate roll numbers within the same class
  UNIQUE KEY unique_roll_per_class (class, roll_number),

  -- Speed up common queries
  INDEX idx_class (class),
  INDEX idx_name (name)
) ENGINE=InnoDB;