-- Update page_count for existing documents
-- This query can be used to manually update page_count if needed
-- Note: This doesn't automatically detect page count - you need to know the correct value

-- Example: Update a specific document's page count
-- UPDATE documents SET page_count = 2 WHERE id = 'your-document-id';

-- Example: Update all documents that have page_count = 0 or 1 (if you know they should have more)
-- UPDATE documents SET page_count = 2 WHERE page_count <= 1 AND id IN ('doc-id-1', 'doc-id-2');

-- View documents with their current page counts
-- SELECT id, name, page_count, file_size FROM documents WHERE status = 'active' ORDER BY created_at DESC;


