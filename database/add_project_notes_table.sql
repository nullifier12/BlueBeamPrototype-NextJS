-- Project Notes Messages Table
-- Stores individual messages/notes in conversation style with user mentions support

CREATE TABLE IF NOT EXISTS project_notes (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    author_id VARCHAR(36) NOT NULL,
    message TEXT NOT NULL,
    mentions JSON, -- Array of user IDs mentioned in the message (e.g., ["user-id-1", "user-id-2"])
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_project_id (project_id),
    INDEX idx_author_id (author_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

