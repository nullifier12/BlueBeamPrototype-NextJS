-- BlueBeam Prototype Database Schema
-- MySQL Database Script
-- Import this into MySQL Workbench

CREATE DATABASE IF NOT EXISTS bluebeam_prototype CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bluebeam_prototype;

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    avatar TEXT,
    color VARCHAR(7) DEFAULT '#0066cc',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    target_completion DATE,
    company_name VARCHAR(255),
    calibration_factor DECIMAL(10, 4) DEFAULT 1.0,
    project_notes TEXT,
    scale DECIMAL(10, 4) DEFAULT 1.0,
    inspection_notes TEXT,
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_project_id (project_id),
    INDEX idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Project Users (many-to-many relationship)
CREATE TABLE IF NOT EXISTS project_users (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    role ENUM('owner', 'admin', 'member', 'viewer') DEFAULT 'member',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_project_user (project_id, user_id),
    INDEX idx_project_id (project_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PDF Documents table
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    file_path TEXT,
    file_url TEXT,
    file_data LONGTEXT,
    file_size BIGINT NOT NULL,
    page_count INT NOT NULL DEFAULT 0,
    status ENUM('active', 'archived', 'deleted') DEFAULT 'active',
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_project_id (project_id),
    INDEX idx_status (status),
    INDEX idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Annotations table
CREATE TABLE IF NOT EXISTS annotations (
    id VARCHAR(36) PRIMARY KEY,
    document_id VARCHAR(36) NOT NULL,
    project_id VARCHAR(36) NOT NULL,
    type VARCHAR(50) NOT NULL,
    page INT NOT NULL,
    position_x DECIMAL(10, 2) NOT NULL,
    position_y DECIMAL(10, 2) NOT NULL,
    position_width DECIMAL(10, 2),
    position_height DECIMAL(10, 2),
    position_radius DECIMAL(10, 2),
    position_points JSON,
    position_path_data TEXT,
    position_center JSON,
    position_start_point JSON,
    position_end_point JSON,
    position_start_angle DECIMAL(10, 4),
    position_end_angle DECIMAL(10, 4),
    position_sweep_flag INT,
    position_large_arc_flag INT,
    content TEXT,
    style_color VARCHAR(7) NOT NULL,
    style_opacity DECIMAL(3, 2) DEFAULT 1.0,
    style_stroke_width DECIMAL(5, 2),
    style_stroke_color VARCHAR(7),
    style_fill_color VARCHAR(7),
    style_font_size INT,
    style_font_family VARCHAR(100),
    metrics_area DECIMAL(10, 4),
    metrics_perimeter DECIMAL(10, 4),
    metrics_length DECIMAL(10, 4),
    metrics_radius DECIMAL(10, 4),
    metrics_rx DECIMAL(10, 4),
    metrics_ry DECIMAL(10, 4),
    metrics_area_px DECIMAL(10, 4),
    metrics_length_px DECIMAL(10, 4),
    metrics_text TEXT,
    author_id VARCHAR(36) NOT NULL,
    is_visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_document_id (document_id),
    INDEX idx_project_id (project_id),
    INDEX idx_author_id (author_id),
    INDEX idx_type (type),
    INDEX idx_page (page)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Punch List Items table
CREATE TABLE IF NOT EXISTS punch_list_items (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    annotation_id VARCHAR(36),
    document_id VARCHAR(36),
    description TEXT NOT NULL,
    demarcation VARCHAR(255),
    demarcation_id VARCHAR(10),
    demarcation_image LONGTEXT,
    location TEXT,
    page INT,
    position_x DECIMAL(10, 2),
    position_y DECIMAL(10, 2),
    status ENUM('Open', 'In-Progress', 'Closed') DEFAULT 'Open',
    percent_complete INT DEFAULT 0,
    assigned_to VARCHAR(255),
    attachments JSON,
    comments TEXT,
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (annotation_id) REFERENCES annotations(id) ON DELETE SET NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_project_id (project_id),
    INDEX idx_annotation_id (annotation_id),
    INDEX idx_document_id (document_id),
    INDEX idx_status (status),
    INDEX idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default admin user (password: admin123 - change this!)
-- Run: node database/setup-admin.js to set the password properly
-- Or manually update the password hash after import
INSERT INTO users (id, username, password, name, email, color) VALUES
('1', 'admin', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Administrator', 'admin@bluebeam.com', '#0066cc')
ON DUPLICATE KEY UPDATE username=username;

-- Insert sample project for testing
INSERT INTO projects (id, project_id, name, location, company_name, calibration_factor, created_by) VALUES
('1', 'PROJ-001', 'Sample Project', 'Manila, Philippines', 'Sample Company', 1.0, '1')
ON DUPLICATE KEY UPDATE project_id=project_id;

-- Insert project user relationship
INSERT INTO project_users (id, project_id, user_id, role) VALUES
('1', '1', '1', 'owner')
ON DUPLICATE KEY UPDATE project_id=project_id;

