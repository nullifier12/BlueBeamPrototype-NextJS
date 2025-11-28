-- Add annotation_type_adjustments table
-- This table stores default settings and adjustments for each annotation type

USE bluebeam_prototype;

CREATE TABLE IF NOT EXISTS annotation_type_adjustments (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36),
    type VARCHAR(50) NOT NULL,
    default_color VARCHAR(7) DEFAULT '#0066cc',
    default_opacity DECIMAL(3, 2) DEFAULT 1.0,
    default_stroke_width DECIMAL(5, 2) DEFAULT 2.0,
    default_stroke_color VARCHAR(7),
    default_fill_color VARCHAR(7),
    default_font_size INT DEFAULT 12,
    default_font_family VARCHAR(100) DEFAULT 'Arial',
    is_enabled BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    icon VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE KEY unique_project_type (project_id, type),
    INDEX idx_project_id (project_id),
    INDEX idx_type (type),
    INDEX idx_is_enabled (is_enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default type adjustments (project_id NULL means global defaults)
INSERT INTO annotation_type_adjustments (id, project_id, type, default_color, default_opacity, default_stroke_width, description) VALUES
('type-001', NULL, 'highlight', '#FFFF00', 0.3, 2.0, 'Text highlighting tool'),
('type-002', NULL, 'text', '#0066cc', 1.0, 1.0, 'Text annotation tool'),
('type-003', NULL, 'sticky-note', '#FFA500', 0.9, 1.0, 'Sticky note annotation'),
('type-004', NULL, 'rectangle', '#0b74de', 0.3, 2.0, 'Rectangle shape tool'),
('type-005', NULL, 'circle', '#0b74de', 0.3, 2.0, 'Circle shape tool'),
('type-006', NULL, 'ellipse', '#0b74de', 0.3, 2.0, 'Ellipse shape tool'),
('type-007', NULL, 'line', '#000000', 1.0, 2.0, 'Line drawing tool'),
('type-008', NULL, 'arrow', '#000000', 1.0, 2.0, 'Arrow tool'),
('type-009', NULL, 'measurement', '#FF0000', 1.0, 2.0, 'Measurement tool'),
('type-010', NULL, 'calibrate', '#FF0000', 1.0, 2.0, 'Calibration tool'),
('type-011', NULL, 'polyline', '#000000', 1.0, 2.0, 'Polyline tool'),
('type-012', NULL, 'arc', '#000000', 1.0, 2.0, 'Arc tool'),
('type-013', NULL, 'cloud', '#00CCCC', 0.3, 2.0, 'Cloud markup tool'),
('type-014', NULL, 'freehand', '#000000', 1.0, 2.0, 'Freehand drawing tool')
ON DUPLICATE KEY UPDATE type=type;

